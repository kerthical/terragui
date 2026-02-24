import type { ArchitectureSeed } from "~/scripts/seeds/types";

const archiveBucket = `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws",
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-west-2"
}

resource "aws_s3_bucket" "archive" {
  bucket        = "terragui-archive-logs"
  force_destroy = false

  tags = {
    Name = "terragui-archive",
    Env  = "sandbox",
  }
}`;

const threeTierApp = `terraform {
  required_version = ">= 1.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "ap-northeast-1" # 東京リージョン
}

# -----------------------------------------------------------------------------
# Variables & Locals
# -----------------------------------------------------------------------------
locals {
  project_name = "demo-complex-arch"
  common_tags = {
    Project     = local.project_name
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}

variable "db_password" {
  description = "RDSのルートパスワード（実際の本番環境ではSecrets Manager等を使用してください）"
  type        = string
  default     = "ChangeMe123!"
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Network (VPC, Subnets, GWs)
# -----------------------------------------------------------------------------
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.common_tags, { Name = "\${local.project_name}-vpc" })
}

# AZの取得
data "aws_availability_zones" "available" {
  state = "available"
}

# --- Public Subnets (ALB, NAT GW用) ---
resource "aws_subnet" "public" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index) # 10.0.0.0/24, 10.0.1.0/24
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = merge(local.common_tags, { Name = "\${local.project_name}-public-\${count.index + 1}" })
}

# --- Private Subnets (App用) ---
resource "aws_subnet" "private_app" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index + 10) # 10.0.10.0/24, 10.0.11.0/24
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = merge(local.common_tags, { Name = "\${local.project_name}-private-app-\${count.index + 1}" })
}

# --- Private Subnets (DB用) ---
resource "aws_subnet" "private_db" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index + 20) # 10.0.20.0/24, 10.0.21.0/24
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = merge(local.common_tags, { Name = "\${local.project_name}-private-db-\${count.index + 1}" })
}

# --- Internet Gateway ---
resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id
  tags   = merge(local.common_tags, { Name = "\${local.project_name}-igw" })
}

# --- NAT Gateway (1つだけ作成してコスト節約。本番では各AZに配置推奨) ---
resource "aws_eip" "nat" {
  domain = "vpc"
  tags   = merge(local.common_tags, { Name = "\${local.project_name}-nat-eip" })
}

resource "aws_nat_gateway" "nat" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
  tags          = merge(local.common_tags, { Name = "\${local.project_name}-nat" })

  depends_on = [aws_internet_gateway.igw]
}

# --- Route Tables ---
# Public
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }
  tags = merge(local.common_tags, { Name = "\${local.project_name}-rt-public" })
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Private (Via NAT)
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat.id
  }
  tags = merge(local.common_tags, { Name = "\${local.project_name}-rt-private" })
}

resource "aws_route_table_association" "private_app" {
  count          = 2
  subnet_id      = aws_subnet.private_app[count.index].id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "private_db" {
  count          = 2
  subnet_id      = aws_subnet.private_db[count.index].id
  route_table_id = aws_route_table.private.id
}

resource "aws_security_group" "alb" {
  name   = "\${local.project_name}-alb-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "\${local.project_name}-alb-sg" })
}

resource "aws_security_group" "app" {
  name   = "\${local.project_name}-app-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "\${local.project_name}-app-sg" })
}

resource "aws_security_group" "db" {
  name   = "\${local.project_name}-db-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "\${local.project_name}-db-sg" })
}

resource "aws_lb" "app" {
  name               = "\${local.project_name}-alb"
  load_balancer_type = "application"
  subnets            = aws_subnet.public[*].id
  security_groups    = [aws_security_group.alb.id]
  tags               = merge(local.common_tags, { Name = "\${local.project_name}-alb" })
}

resource "aws_lb_target_group" "app" {
  name     = "\${local.project_name}-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    path                = "/"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    timeout             = 5
    matcher             = "200"
  }

  tags = merge(local.common_tags, { Name = "\${local.project_name}-tg" })
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.app.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

resource "aws_instance" "app" {
  count                  = 2
  ami                    = "ami-0c02fb55956c7d316"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.private_app[count.index].id
  vpc_security_group_ids = [aws_security_group.app.id]
  tags                   = merge(local.common_tags, { Name = "\${local.project_name}-app-\${count.index + 1}" })
}

resource "aws_lb_target_group_attachment" "app" {
  count            = 2
  target_group_arn = aws_lb_target_group.app.arn
  target_id        = aws_instance.app[count.index].id
  port             = 80
}

resource "aws_db_subnet_group" "main" {
  name       = "\${local.project_name}-db-subnet"
  subnet_ids = aws_subnet.private_db[*].id
  tags       = merge(local.common_tags, { Name = "\${local.project_name}-db-subnet" })
}

resource "aws_db_instance" "main" {
  identifier             = "\${local.project_name}-db"
  engine                 = "mysql"
  engine_version         = "8.0"
  instance_class         = "db.t3.micro"
  allocated_storage      = 20
  username               = "admin"
  password               = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  skip_final_snapshot    = true
  tags                   = merge(local.common_tags, { Name = "\${local.project_name}-db" })
}`;

export const awsArchitectures: ArchitectureSeed[] = [
  {
    slug: "s3-archive",
    name: "Archive Bucket",
    description: "Single S3 bucket baseline example",
    sourceType: "scratch",
    provider: "aws",
    files: [{ path: "main.tf", content: archiveBucket }],
  },
  {
    slug: "three-tier-app",
    name: "Three Tier Application",
    description: "A more complex architecture with VPC, Subnets, ALB, EC2, and RDS",
    sourceType: "scratch",
    provider: "aws",
    files: [{ path: "main.tf", content: threeTierApp }],
  },
];
