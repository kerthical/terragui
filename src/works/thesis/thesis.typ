#import "@preview/cetz:0.4.2" as cetz
#import "@preview/fletcher:0.5.8" as fletcher

#set page(paper: "a4", margin: (top: 25.4mm, bottom: 25.4mm, left: 25mm, right: 25mm))
#set text(font: "Noto Serif CJK JP", lang: "ja", size: 10pt)
#set par(justify: true, first-line-indent: (amount: 1em, all: true), leading: 0.8em)
#set heading(numbering: "1.1")
#set figure(placement: auto)
#show figure.caption: set text(size: 10pt)
#show figure.where(kind: table): set figure.caption(position: top)
#show table: set table(inset: 6pt, align: left + horizon)
#show outline.entry.where(level: 1): set block(above: 12pt + 1em, below: 12pt + 1em)
#show outline.entry.where(level: 1): set text(weight: "bold")
#show outline.entry.where(level: 1): set outline.entry(fill: repeat(gap: 0.2em)[#text(size: 8pt)[.]])
#show outline.entry.where(level: 2): set outline.entry(fill: repeat(gap: 0.01em)[#text(size: 8pt)[.]])
#show heading.where(level: 1): set text(size: 14pt, weight: "bold")
#show heading.where(level: 2): set text(size: 12pt, weight: "bold")
#show heading.where(level: 3): set text(size: 11pt, weight: "bold")
#show heading.where(level: 1): set block(above: 3em, below: 1em)
#show heading.where(level: 2): set block(above: 2.5em, below: 1em)
#show heading.where(level: 3): set block(above: 2em, below: 1em)

#let placeholder(height: 8cm, caption-text: "") = {
  figure(
    rect(width: 100%, height: height, fill: palette.gray.lighten(80%), stroke: 1pt + palette.gray)[
      #align(center + horizon)[
        #text(fill: rgb(0, 0, 0))["#caption-text"がここに入る]
      ]
    ],
    caption: caption-text,
  )
}

#let palette = (
  blue: rgb(96, 130, 172),
  indigo: rgb(108, 114, 156),
  green: rgb(102, 144, 126),
  gray: rgb(150, 150, 150),
  orange: rgb(196, 148, 104),
  red: rgb(186, 118, 112),
)

#page(margin: (top: 35mm, bottom: 30mm, left: 30mm, right: 30mm))[
  #align(center)[
    #v(23mm)
    #text(size: 16pt)[卒業研究報告書]
    #v(3mm)
    #text(size: 10pt)[題目]
    #v(1mm)
    #text(size: 24pt)[#underline(offset: 4pt)[HCLと意味的に階層化されたUIの相互変換によるクラウド構成の視覚的編集]]
    #v(25mm)
    #text(size: 10pt)[指導教員]
    #v(-2mm)
    #text(size: 16pt)[#underline(offset: 4pt)[井口信和教授]]
    #v(17.5mm)
    #text(size: 10pt)[報告者]
    #v(3mm)
    #text(size: 10pt)[22-1-211-0187]
    #v(-4mm)
    #text(size: 24pt)[#underline(offset: 4pt)[平田麟太朗]]
    #v(0mm)
    #text(size: 10pt)[近畿大学情報学部情報学科]
    #v(20mm)
    #text(size: 10pt)[2025年12月30日提出]
  ]
]

#page(margin: (top: 35mm, bottom: 30mm, left: 30mm, right: 30mm))[
  #align(center)[
    #text(weight: "bold", size: 14pt)[概要]
  ]
  #v(0mm)
  クラウドコンピューティングの普及に伴い，Infrastructure as Codeは現代のシステム開発において不可欠なプラクティスとなっている．中でもHashiCorp社が提供するTerraformは，宣言的な記述言語であるHashiCorp Configuration Languageを用いることで，マルチクラウド環境におけるリソース管理の事実上の標準としての地位を確立している．しかし，システムが大規模化・複雑化するにつれて，テキストベースのコードのみからリソース間の依存関係や全体構造を把握することは困難となり，開発者の認知負荷が増大するという課題がある．

  この課題に対し，Terraformの構成を可視化するツールは多数存在するが，その多くは一方通行の可視化にとどまるか，あるいは編集が可能であってもコード内のコメントやフォーマットといったメタ情報を保持できないという問題がある．Infrastructure as Codeにおいてコードは唯一の信頼源であり，ツールによる自動生成でコードの可読性が損なわれることは，保守性の観点から許容しがたい．

  本研究では，HCLコードの構造を維持したまま視覚的な編集を可能にするOSS環境「TerraGUI」を提案・開発する．本システムは，HCLの具象構文木を用いた独自の中間表現により，コードとグラフ表現のロスレスな相互変換を実現した．具体的には，typescript-parsecを用いてHCLをトークンレベルで解析し，コメントや空白を含む構文木を構築する．さらに，elkjsによるレイアウトアルゴリズムとリソース属性の解析を組み合わせることで，VPCやサブネットといった包含関係を考慮した意味的に階層化されたグラフを自動生成する．

  本論文では，提案システムの設計思想，Next.jsとReact Flowを用いた実装の詳細，及びAmazon Web Services，Google Cloud Platform，Microsoft Azureといった主要クラウドプロバイダへの対応について述べる．また，実装したシステムを機能的に評価し，既存のInfrastructure as Codeワークフローを破壊することなく，視覚的な支援による生産性向上が達成できることを示す．
]

#page(margin: (top: 35mm, bottom: 30mm, left: 30mm, right: 30mm))[
  #outline(
    title: "目次",
    depth: 3,
    indent: auto,
  )
]

#counter(page).update(1)
#set page(numbering: "1")

= 序論

== 研究背景
近年，デジタルトランスフォーメーションの加速に伴い，企業におけるクラウドサービスの利用は拡大の一途を辿っている．Amazon Web Services，Google Cloud Platform，Microsoft Azureといったパブリッククラウドプロバイダは，コンピュート，ストレージ，ネットワークに加え，機械学習やIoTといった高度なマネージドサービスを提供しており，これらを組み合わせることで迅速なサービス開発が可能となっている．

こうした環境において，インフラストラクチャの構築・管理を手動で行うことは，操作ミスの誘発や再現性の欠如といったリスクを伴う．また，手動操作のログは残りにくく，監査や変更履歴の追跡が困難である．そのため，インフラの構成をコードとして記述し，バージョン管理システムで管理するInfrastructure as Codeの手法が一般化した．Infrastructure as Codeツールの中でもTerraform @terraform は，特定のクラウドベンダーに依存しないオープンソースのツールとして広く利用されている．TerraformはHashiCorp Configuration Language @hcl と呼ばれる独自のドメイン固有言語を用い，リソースの状態を宣言的に定義する．

一方，Infrastructure as Codeの実現手段はTerraformに限らない．AWS CloudFormation @cloudformation，Azure Resource Managerテンプレート @azure_arm，Google Cloud Deployment Manager @gcp_deployment_manager といったクラウド固有DSLに加え，Pulumi @pulumi やCDK for Terraform @cdktf のような汎用言語ベースのアプローチが存在する．さらに，Ansible @ansible，Puppet @puppet，Chef @chef，SaltStack @saltstack といった構成管理系のツールも，Infrastructure as Codeの実践において重要な位置を占める．このようにInfrastructure as Codeは多様な技術レイヤに広がっており，それぞれが異なる表現力や運用モデルを持つ．

== 現状の課題
Infrastructure as Codeの導入により，インフラ構築の自動化や再現性の確保は達成された．しかし，テキストベースの管理には依然として以下のような課題が残る．

まず，全体像把握の困難さが挙げられる．大規模なシステムでは数千行に及ぶHCLコードが記述され，リソース間の依存関係は複雑に絡み合う．コード上の参照記述を追うだけでは，システム全体のトポロジーを脳内で構築することは，熟練したエンジニアであっても困難である @QUEVAL2025107761．

次に，学習コストの高さがある．クラウドプロバイダが提供するリソースの種類は膨大であり，それぞれに固有の設定項目が存在する．初学者が正しいHCLの構文と各リソースの必須パラメータを同時に理解し，適切な構成を記述するには多くの時間を要する．エディタの補完機能も存在するが，視覚的な補助なしにアーキテクチャを設計することは難しい．

また，既存ツールの限界も課題である．これらの課題を解決するために，Brainboard @brainboard やTerraform Visual @tfvisual，Inframap @inframap，Blast Radius @blast_radius，terraform graph @terraform_graph などの可視化ツールが存在する．しかし，これらは既存のコードを読み込んで図示するだけの一方通行であったり，GUIで編集すると元のコードのコメントやフォーマットが破壊される不可逆的変換といった問題を抱えている．特に後者は，コードレビューの妨げとなり，既存の開発フローとの親和性を著しく低下させる．

さらに，品質・セキュリティ観点の複雑化がある．Infrastructure as Codeは通常のソフトウェアと同様に欠陥やコードスメルを内包し得ることが示されており，欠陥分類やアンチパターン，スメル検出に関する研究が蓄積されている @RahmanFPW20 @RahmanFW20 @Rahman18ICSE @RahmanSW18 @Rahman18ICST @SchwarzSL18．さらに，セキュリティスメルや秘密情報の扱いに関する実証研究もあり，設定の誤りがシステム全体の脆弱性につながることが報告されている @RahmanPW19 @RahmanW21 @RahmanBM21 @WarDHKB25．

加えて，運用とレビューの断絶も問題となる．Infrastructure as Codeの保守にはレビューが不可欠であるが，レビュー時に全体構造を把握できないことが品質低下につながるとの報告がある @BessghaierOSCM25．また，Terraform Registry上のモジュール更新や依存関係の追跡は複雑であり，メンテナンス負荷が増大する @terraform_registry @Begoug0C25．

== 研究の目的
本研究の目的は，Infrastructure as Codeの利点であるコードによる管理を損なうことなく，視覚的な操作による直感的な理解と編集を両立する環境を構築することである．具体的には，以下の要件を満たすOSSツール「TerraGUI」を開発する．

第一に，ロスレスな相互変換である．HCLコードとグラフUIの間で，コメントや空白を含む全ての情報を保持したまま双方向に同期する．これにより，GUIでの変更が最小限の差分としてコードに反映される．第二に，意味的な可視化である．単なるリソースの羅列ではなく，ネットワーク階層やVPC，Subnetといった論理グループに基づいた見やすいグラフ構造を自動生成する．第三に，既存ワークフローとの統合である．独自の保存形式を導入せず，標準的なHCLテキストをそのまま保持することで，既存のGitベースの開発フローへ円滑に組み込めるようにする．第四に，スキーマ駆動の編集体験である．Terraformプロバイダのスキーマ情報 @terraform_providers_schema を利用し，リソース属性の入力支援と妥当性の高い編集体験を提供する．

== 本研究の貢献
本研究では，HCLの具象構文木を用いたロスレス編集機構を設計・実装し，コメントや整形を保持したままの差分更新を可能にした @hclspec @hclwrite．また，リソース属性から意味的な包含関係を推論するグラフ構築アルゴリズムを設計し，視認性の高い階層化グラフを自動生成した @elkjs．さらに，Terraformプロバイダスキーマを用いた動的プロパティエディタと，公式アイコンセットの自動マッピング機構を実装した @terraform_providers_schema．加えて，HCLテキストを単一の真実源とし，graph_jsonを派生データとして扱うローカルファースト設計を採用することで，編集体験と整合性を確保した．

== 論文の構成
本論文は全10章で構成される．
第1章では，研究の背景，課題，目的について述べた．
第2章では，関連技術を概説する．
第3章では，関連研究と既存ツールを比較する．
第4章では，提案システム「TerraGUI」の概要と設計思想について述べる．
第5章では，システムの実装詳細，特にHCL解析エンジンとグラフエンジンの仕組みについて詳述する．
第6章では，ユーザインターフェースとワークフローを紹介する．
第7章では，データ管理と運用設計を述べる．
第8章で評価し，第9章で考察する．
第10章で結論と今後の展望を述べる．

= 関連技術

== Infrastructure as CodeとTerraform
Infrastructure as Codeは，サーバー，ネットワーク，データベースなどのインフラ構成を，スクリプトや定義ファイルとして記述し，ソフトウェア開発のベストプラクティスをインフラ運用に適用する手法である．

Terraformは，HashiCorp社が開発するInfrastructure as Codeツールであり，以下の特徴を持つ．まず，宣言的記述として，手順ではなく，あるべき状態を記述する．次に，リソースグラフとして，リソース間の依存関係をグラフとして管理し，適切な順序で作成・更新する @terraform_graph．また，Stateファイルとして，実環境の状態をJSON形式のファイルに記録し，コードとの差分を検出する．

Terraform Registryは，プロバイダとモジュールを共有するエコシステムの基盤であり，構成部品の再利用性を高めている @terraform_registry．また，Terraform Language ServerはHCLの静的解析や補完に利用される @terraform_ls．

=== Terraform言語仕様と実行モデル
Terraform Languageは，宣言的なリソースブロックと式評価を組み合わせることで，構成の再利用と差分更新を可能にする．ブロック内の属性値は式として評価され，for式や条件式，nullish演算子，関数呼び出しなどの表現力を持つ @terraform_expressions．また，dynamicブロックにより反復的なネスト構造を記述でき，count，for_each，depends_on，provider，lifecycleといったメタ引数は，繰り返しや依存関係，ライフサイクル制御を担う @terraform_dynamic_blocks @terraform_meta_arguments．

構成の再利用性はモジュール単位で整理される．モジュールは入力変数と出力を持つ再利用単位であり，リポジトリ全体の規模拡大を前提とした設計指針となる @terraform_modules．状態管理はstateファイルによって実現され，実環境のリソースとコードの対応関係を保持する @terraform_state．ワークスペースは複数環境のstateを分離し，開発・検証・本番の切替を支援する @terraform_workspaces．

実行モデルとしては，planが差分を計算し，applyが実行する二段階プロセスである @terraform_plan @terraform_apply．validateは構文・型・参照を検証し，fmtは表記ゆれを整形する @terraform_validate @terraform_fmt．さらにTerraformはJSON構文を公式にサポートしており，外部ツールとの連携や自動生成の出力先として利用できる @terraform_json @terraform_language．

=== Terraform周辺ツールと運用
Terraformの周辺には，運用や品質保証を支援するツール群が存在する．Terragruntは複数環境の管理を支援し，TFLintやtfsec，Checkov，Terrascanはコード規約やセキュリティを検証する @terragrunt @tflint @tfsec @checkov @terrascan．Infracostはコストを見積もり，OPAやConftestはポリシーをコードとして適用する @infracost @opa @conftest．これらのツールはInfrastructure as Codeの保守性向上に寄与するが，グラフUIとの統合は限定的である．

=== Infrastructure as Code運用プラットフォームと実行基盤
Terraformの運用は，CI/CDと権限管理を統合したプラットフォームと密接に関連する．HCP Terraform（Terraform Cloud）はリモート実行，ポリシー評価，状態管理を担う @terraform_cloud．また，Terraformの互換実装としてOpenTofuが登場し，ライセンスやコミュニティ主導の開発体制が議論の対象となっている @opentofu．

実務では，Pull Request駆動でPlan/Applyを行うAtlantis，複数クラウド/組織を横断したポリシーと実行を提供するSpaceliftやScalrなどが用いられる @atlantis @spacelift @scalr．さらに，Terraform以外のオーケストレーション基盤としてCloudifyがあり，多様なDSLの統合を支援する @cloudify．本研究はこれらの運用基盤と競合するのではなく，ローカル開発段階の可視化と編集性を補完する位置付けを狙う．

=== HashiCorp Configuration Language
HashiCorp Configuration LanguageはTerraformのために設計された言語であり，JSONと互換性を持ちつつ，人間にとっての可読性と書きやすさを重視している @hcl @hclspec．例えば，リソース定義は以下のようにブロック構造で記述される．

```hcl
resource "aws_instance" "web" {
  ami           = "ami-12345678"
  instance_type = "t2.micro"

  tags = {
    Name = "HelloWorld"
  }
}
```

HCLはJSONへの変換を経由して解析されることが多いものの，その過程でコメントや空行といった意味的に不要だが人間には必要な情報が失われる．この問題に対し，hclwrite @hclwrite やtree-sitter-hcl @tree_sitter_hcl のようなツールは構文解析を支援するが，ロスレス編集を前提とした統合UIまで踏み込む例は少ない．本研究ではtypescript-parsec @typescript_parsec を利用し，トークンを保持した具象構文木を構築する．

== 宣言的基盤とモデル駆動の潮流
Infrastructure as CodeはTerraformだけでなく，より広い宣言的基盤と連続性を持つ．TOSCAはクラウドアプリケーションのトポロジーを宣言的に記述する標準であり，サービス間依存やライフサイクルをモデルとして扱う @tosca．Kubernetesは宣言的なリソース定義によってクラスタ状態を制御し，コントローラが差分を解消するモデルを採用している @kubernetes．CrossplaneはKubernetesの制御ループをクラウドリソースに拡張し，インフラの宣言的管理をKubernetes APIの枠組みに統合する @crossplane．

これらは宣言的定義を単一の真実源とし，実体の状態を収束させるというInfrastructure as Codeの原理を共有する．TerraGUIはTerraformに焦点を当てる一方で，こうした宣言的基盤で共通する可視化・編集課題を解決する枠組みとして位置付けられる．

== 構文解析技術
プログラミング言語の解析において，ソースコードは通常，抽象構文木に変換される．抽象構文木はプログラムの意味的に不要な情報を捨象し，論理構造のみを木構造で表現する．コンパイラやインタプリタにとってはこれで十分であるが，ソースコードを再生成するフォーマッタやリファクタリングツールにとっては不十分である．

これに対し，具象構文木と呼ばれるデータ構造は，ソースコード上の全てのトークンを保持する．PythonにおけるLibCST @libcst やJavaScriptのRecast @recast など，ロスレス編集を志向した具象構文木ライブラリが存在する．本研究では，HCLの編集において元のコードの体裁を維持するために，具象構文木のアプローチを採用する．

構文解析の実装手法としては，ANTLRのようなパーサ生成器を用いて文法仕様から解析器を生成する方法が一般的である @antlr．一方で，パーサコンビネータによる実装は，式の優先順位やエラー箇所の特定といった処理をコードレベルで柔軟に記述できる利点がある．本研究で採用したts-parsecはこの系譜にあり，構文規則を関数合成で記述することで，HCLの式文法を細かく制御できる @typescript_parsec．

また，DSLに対する解析手法としてParsing Expression Grammarが広く知られており，バックトラックを伴う決定的な認識規則として定義される @ford2004peg．Parsing Expression Grammarを効率的に扱うためのPackrat Parsingは，メモ化によって線形時間解析を保証する手法である @ford2002packrat．HCLのように条件式やスプラット式など多様な構文要素を持つ言語では，このような規則性の高い解析モデルが有効である．

構文解析手法とCST利用の位置付けは @fig:parsing-cst-position に示す．
#[
  #set text(size: 9pt)
  #figure(
    cetz.canvas({
      import cetz.draw: *

      let width = 12
      let height = 9
      let cx = width / 2
      let cy = height / 2
      let padding = 0.2
      let axis-col = palette.gray.darken(45%)

      line((0, cy), (width, cy), stroke: axis-col + 1pt, mark: (end: "stealth"))
      line((cx, 0), (cx, height), stroke: axis-col + 1pt, mark: (end: "stealth"))

      content((padding, cy - padding), [生成型], anchor: "north-west")
      content((width - padding, cy - padding), align(center)[手書き型 \ コンビネーター], anchor: "north-east")

      content((cx + padding, height - 0.3), align(center)[CST (完全)], anchor: "north-west")
      content((cx + padding, 0.3), align(center)[AST (最小)], anchor: "south-west")
      let points = (
        (2.5, 2.5, "ANTLR", "コンパイラ", palette.blue),
        (2.2, 7, "ANTLR", "フォーマッタ", palette.blue),
        (9, 2.6, "パーサ", "柔軟な式処理", palette.indigo),
        (9.2, 7.2, "ts-parsec", "本研究", palette.red),
        (5.5, 2, "PEG", "効率的解析", palette.green),
        (5.8, 6.5, "PEG+CST", "トークン保持", palette.green),
      )

      for (x, y, label1, label2, col) in points {
        let box-width = 2.7
        let box-height = 1.3

        rect(
          (x - box-width / 2, y - box-height / 2),
          (x + box-width / 2, y + box-height / 2),
          fill: col.lighten(25%),
          stroke: axis-col + 1.5pt,
          radius: 0.15,
        )

        content(
          (x, y),
          align(center)[
            #set text(fill: rgb(0, 0, 0), weight: "medium")
            #label1 \
            #v(-20pt) \
            #label2
          ],
          anchor: "center",
        )
      }
    }),
    caption: [構文解析手法とCST利用の位置付け],
  ) <fig:parsing-cst-position>
]

== グラフ可視化とレイアウト
依存関係を可視化する手段として，Graphviz @graphviz とDOT言語 @dotlang は代表的な手法である．Terraformのterraform graphもDOTを出力するため，Graphvizと組み合わせて静的な依存関係図を生成できる @terraform_graph．

一方，本研究ではインタラクティブな編集を前提とするため，Web上でのグラフ操作を支えるReact Flow (XYFlow) @xyflow と，自動レイアウトエンジンELK/elkjs @elk @elkjs を採用する．ELKのlayeredアルゴリズムは依存方向が明確なグラフに適しており，階層構造を維持した配置を生成できる．

Layeredレイアウトは，Sugiyama法に代表される階層型グラフ描画の系譜に属する @sugiyama81．ノードを階層ごとに割り当て，エッジ交差を最小化しながら配置を最適化するため，大規模な依存関係図でも読みやすい配置を得られる．TerraGUIでは，ELKのレイアウト結果をReact Flowの座標に変換し，エッジラベル位置も含めて保持することで，静的図と同等の視認性を保ちながらインタラクション性を維持する．

== Webフロントエンド技術
=== Next.js App Router
Next.js @nextjs はReactベースのWebフレームワークであり，App RouterはReact Server Components (RSC) を基盤としている．RSCにより，コンポーネントをサーバー側でレンダリングし，クライアントへの転送データ量を削減できる．また，Server Actions機能により，APIエンドポイントを明示的に作成することなく，関数呼び出しのようにサーバー側の処理を実行できる．本研究では，ファイルシステムへのアクセスやDB操作を伴う処理においてServer Actionsを多用している．

=== React FlowとELK.js
React Flowは，ノードベースのアプリケーションを構築するためのReactライブラリである．ノードのドラッグ移動，ズーム，パンといった基本的なインタラクション機能を提供し，カスタムノードやカスタムエッジの実装も容易である @xyflow．
ELK.js (Eclipse Layout Kernel for JavaScript) は，グラフを自動レイアウトするライブラリである @elkjs．複雑なノード間の接続関係を解析し，エッジの交差を最小化しつつ，階層構造を持った見やすい配置座標を計算する．本システムでは，React Flowの表示座標を決定するためにELK.jsを利用している．

=== コードエディタとUI基盤
コードエディタにはMonaco Editor @monaco を用いる．MonacoはVS Codeのエディタコアを提供し，高速なレンダリングと拡張性を持つ．UIの構築にはReact @react，Next.js @nextjs を基盤とし，Tailwind CSS @tailwindcss とRadix UI @radixui を利用してコンポーネントの一貫性を担保する．

UIレイアウトの分割にはAllotmentを使用し，グラフとエディタの2ペイン構成を柔軟に調整できる @allotment．フォーム入力はReact Hook Formで状態を管理し，Zodで入力を検証することで，入力エラーを早期に検知する @react_hook_form @zod．アイコンはLucideのSVGセットを利用し，機能や操作の視認性を高める @lucide．

== データ管理とORM
データベースにはSQLite @sqlite を採用し，ORMとしてDrizzle @drizzle を利用する．SQLiteは軽量でローカル配布に適しており，Drizzleは型安全なSQL生成で保守性を高める．この組み合わせにより，ローカルファーストなアプリケーション設計を実現できる．

== 開発・配布基盤
開発環境にはNode.js @nodejs を基盤とし，Docker @docker とDev Containers @devcontainers で実行環境を再現可能にする．エディタにはVS Code @vscode を想定し，Biome @biome で静的解析，Lefthook @lefthook とcommitlint @commitlint で品質を担保する．

= 関連研究・既存ツール

== Infrastructure as Codeの品質・欠陥・保守性に関する研究
Infrastructure as Codeの品質に関する研究では，欠陥分類やアンチパターン，コードスメルの体系化が進んでいる．欠陥分類としてはGang of Eightや欠陥特徴量の分析が報告されている @RahmanFPW20 @RahmanW19 @Rahman18ICSE @RahmanSW18．また，アンチパターンやスメルの定義と検出方法に関する研究が進められており，Infrastructure as Code特有の設計上の問題が指摘されている @RahmanFW20 @Rahman18ICST @SchwarzSL18．さらに，Infrastructure as Codeに潜む状態不整合や運用時の欠陥を分析する研究や，文書とコードの不整合を機械学習で検出する研究が報告されている @DrososSAM024 @HassanSSR24 @BorovitsKNKPPTH22．Infrastructure as Code言語を跨いでスメルを検出するGLITCHのようなアプローチも提案されている @SaavedraGHFM23 @Saavedra0M24．ツール支援の有効性を比較する研究や，DevOps成熟度に対するInfrastructure as Codeの影響を示す事例研究も存在する @SandobalinIA20 @SouzaFS23．体系的マッピング研究により，Infrastructure as Code研究の空白領域や欠陥の分類観点が整理されている @abs1807_04872 @abs1809_07937．これらの研究は，Infrastructure as Codeが一般的なソフトウェアと同様に品質課題を抱えることを示す．

== Infrastructure as Codeのセキュリティと秘密情報管理
Infrastructure as Codeはセキュリティ設定をコード化するため，誤設定の影響が広範囲に及ぶ．セキュリティスメルの分類や実証評価，秘密情報管理の実践指針が提案されている @RahmanPW19 @RahmanW21 @RahmanBM21．さらに大規模な脆弱性調査や脅威モデリングの研究も進展し，Infrastructure as Codeの安全性確保が重要な課題である @WarDHKB25 @TranSYJ25．

Terraformを対象としたセキュリティスメルの研究では，インフラ定義に潜む脆弱な構成が網羅的に整理されている @abs1907_07159．Infrastructure as Codeスクリプト内で共起する不安全パターンの分析も行われ，セキュリティルールの設計が課題となっている @BhuiyanR20．最近ではタクソノミの更新や新たなスメルの追加が提案され，より広い脆弱性クラスを扱う動きがある @abs2509_18761．また，クラウドプロバイダ間でのセキュリティポリシー採用状況を調べる研究や，DevSecOps環境でのポリシー自動化の実装事例も報告されている @VerdetHSK25 @LukaczykM25．さらに，Infrastructure as Codeで構築された環境を対象にした侵入検知やネットワーク保護の研究も進んでおり，運用段階における安全性検証が重視されつつある @FilhoVSG25．

== 理解容易性・レビュー・運用
Infrastructure as Codeの理解容易性やレビューに関する研究では，設計レベルの理解やレビュー実践の実証研究が報告されている @QUEVAL2025107761 @BessghaierOSCM25．また，Infrastructure as Codeの研究動向を俯瞰する体系的マッピングや技術レビューも行われており，研究領域の成熟が進んでいる @RahmanMW19 @PahlGSGI25．

運用面では，設計レベルのセキュリティ実践が理解可能性に与える影響を測定する研究があり，コードだけでなく図やメトリクスを併用する重要性が指摘されている @NtentosLSZSSF25．さらに，APIドキュメントやInfrastructure as Codeとの間で生じるドキュメント複製の実態調査も報告されており，設計情報の一元化が課題として浮上している @Oumaziz20．Ansibleの依存関係を抽出しサプライチェーンを可視化する研究もあり，構成の見通しを支えるツールの必要性が示唆される @OpdebeeckAR25．教育面では，Infrastructure as Codeのセキュア開発を対象にした教材の有効性が検証されている @RahmanSS022．こうした知見は，可視化や編集環境が学習効率とレビュー品質を底上げできる可能性を示す．

== Terraform特化のデータセット・メトリクス・静的解析
TerraformのHCLコードを対象にしたデータセットやメトリクス研究が進展している．TerraDSはTerraformプログラムを大規模に収集したデータセットであり，解析手法の再現性向上に寄与する @BuhlerSMS25．TerraMetricsはTerraform向けの品質メトリクスを実装したOSSであり，モジュール構造や依存度を定量化する基盤として利用できる @BegougC024．

静的解析の観点では，Terraformマニフェストに対する警告の分類や実運用での有効性が検証されている @HuBWSSR23．品質計測の枠組みを包括的に整理した研究も登場しており，Infrastructure as Codeの品質評価指標の整備が進んでいる @abs2502_03127．これらの研究は，本研究の評価設計やテスト指標選定に直接的な示唆を与える．

Terraform特化研究の分類と評価指標は @fig:terraform-research-map に整理する．

#[
  #set text(size: 9pt)
  #figure(
    table(
      columns: (1.6fr, 2.0fr, 1.1fr),
      table.header([*研究分類*], [*主な研究内容*], [*評価指標*]),

      [セキュリティと秘密情報管理],
      [・セキュリティスメルの分類と実証評価 \ ・脆弱性調査と脅威モデリング \ ・秘密情報管理の実践指針],
      [・スメル検出精度 \ ・脆弱性カバレッジ \ ・ポリシー採用率],

      [理解容易性・レビュー・運用],
      [・設計レベルの理解とレビュー実践 \ ・研究動向の体系的マッピング \ ・可視化とドキュメント管理],
      [・理解時間 \ ・レビュー効率 \ ・ドキュメント整合性],

      [データセット・メトリクス・静的解析],
      [・大規模データセットの構築（TerraDS） \ ・品質メトリクスの実装（TerraMetrics） \ ・静的解析警告の分類と有効性検証],
      [・データセット規模 \ ・メトリクスカバレッジ \ ・警告の精度と再現率],

      [LLM・自動化・エージェント],
      [・コードスメル検出と脆弱性修正 \ ・自動生成ベンチマーク \ ・複数エージェントによるコード生成],
      [・生成品質 \ ・修正精度 \ ・実行成功率],

      [実運用事例と応用領域],
      [・大学IT基盤の再構築事例 \ ・CI/CDパイプライン統合 \ ・マルチクラウド環境での運用],
      [・導入効果 \ ・運用コスト削減 \ ・パフォーマンス比較],

      [HCL解析・変換ツール],
      [・構成の部分編集支援（hcledit） \ ・HCL-JSON変換（hcl2json） \ ・依存関係抽出（terraform-config-inspect）],
      [・解析精度 \ ・変換正確性 \ ・コメント保持性],
    ),
    caption: [Terraform特化研究の分類と評価指標],
  ) <fig:terraform-research-map>
]

== LLM・自動化・エージェント
近年はLLMを用いたInfrastructure as Code支援が注目され，コードスメル検出，脆弱性修正，自動生成ベンチマークなどが提案されている @VoDF25 @TopraniM25 @KonLQFHLZPEK0CL24．複数エージェントによるコード生成や修正，バグ発見支援といった研究も進んでおり，本研究の将来機能として重要な示唆を与える @abs2510_03902 @XiangYPBKQC25 @PengQKZHGWC25．また，Infrastructure as Code修復，ファジング，テンプレート再利用を目指す研究も登場しており，品質向上の自動化に向けた基盤が整備されつつある @Saavedra0M25 @CoppaSS25 @WeiMS25．

== 実運用事例と応用領域
Terraformは研究用途だけでなく，実際の運用事例においても多様な適用が報告されている．大学組織のIT基盤をTerraformとデータ連携ツールで再構築した事例や，CI/CDパイプラインと統合した監視システムの構築事例が報告されており，現場での導入プロセスの課題と効果が示されている @BaroneS25 @RomeroCMACGM22．複数クラウドでのビッグデータ処理基盤や，エネルギー効率を考慮したワークロード配置など，運用設計に関わる応用研究も存在する @Naik21a @CitadinRLNL25．

また，Infrastructure as Code成果物からマイクロサービスパターンを検出する研究や，構成情報を設計レベルに引き上げる試みも進んでいる @Duarte25．TerraformとAWS CDKの比較や，TerraformとCloudifyのオーケストレーション性能比較など，ツール選択に直結する研究も存在する @FroisPOXT24 @CarvalhoA20．これらの応用領域は，Infrastructure as Codeが単なるプロビジョニングに留まらず，設計と運用をつなぐ媒介となり得ることを示す．

== HCL解析・変換ツール
HCLを対象とした解析・変換ツールとして，構成の部分編集を支援するhcleditや，HCLをJSONへ変換するhcl2json，構成から依存関係を抽出するterraform-config-inspectが存在する @hcledit @hcl2json @terraform_config_inspect．これらは既存コードの解析や可視化の前処理に有効であるが，コメントやフォーマットを保持したまま編集することは想定していない．本研究のロスレス編集は，こうした補助ツールの限界を踏まえた上で，UI操作とコードの同一性を維持することを目的とする．

== 既存の可視化・編集ツール
Terraform構成の可視化ツールとして，Terraform Visual @tfvisual，Inframap @inframap，Blast Radius @blast_radius，Brainboard @brainboard が存在する．Terraform VisualとInframapはHCLやstateを入力としてグラフ化するが，編集は限定的である．Blast Radiusは依存関係の探索に優れるが，GUI編集には対応しない．BrainboardはGUI編集をサポートするが独自フォーマットに依存し，既存コードとの整合性確保が課題となる．また，AWS CloudFormation Designer @cloudformation_designer はクラウド固有の可視化機能を提供するが，他クラウドとの統合性は低い．

さらに，クラウド設計やアーキテクチャ図に特化したツールとしてCloudcraftやdiagrams.net，Lucidchartがあり，学習用途やプレゼン資料作成に利用される @cloudcraft @diagrams_net @lucidchart．MermaidやPlantUML，Structurizrはテキストベースで図を記述でき，C4モデルのような抽象レベルの切り替えを支援する @mermaid @plantuml @structurizr @c4model．これらは設計コミュニケーションに優れる一方，Terraformコードとのロスレスな同期は想定されていないため，開発中のコードと設計図が乖離しやすい．

既存ツールの位置付けと編集粒度の比較は @fig:tool-positioning に示す．
#[
  #set text(size: 9pt)
  #figure(
    cetz.canvas({
      import cetz.draw: *

      let width = 12
      let height = 9
      let cx = width / 2
      let cy = height / 2
      let padding = 0.2
      let axis-col = palette.gray.darken(45%)

      line((0, cy), (width, cy), stroke: axis-col + 1pt, mark: (end: "stealth"))
      line((cx, 0), (cx, height), stroke: axis-col + 1pt, mark: (end: "stealth"))

      content((padding, cy - padding), [可視化のみ], anchor: "north-west")
      content((width - padding, cy - padding), [フル編集], anchor: "north-east")

      content((cx + padding, height - 0.3), [IaC運用], anchor: "north-west")
      content((cx + padding, 0.3), [設計図作成], anchor: "south-west")

      let iac-viz = (
        (2.5, 7.8, "Terraform Visual", palette.blue),
        (3.8, 6.8, "Inframap", palette.indigo),
        (2.0, 6.2, "Blast Radius", palette.blue.darken(12%)),
      )

      for (x, y, name, col) in iac-viz {
        circle((x, y), radius: 0.18, fill: col.lighten(40%), stroke: col + 1pt)
        content((x, y - 0.5), text(size: 8.5pt, fill: rgb(0, 0, 0), weight: "semibold")[#name], anchor: "north")
      }

      let iac-edit = (
        (9.5, 7.0, "Brainboard", palette.red),
        (8.2, 6.2, "CF Designer", palette.red.darken(12%)),
      )

      for (x, y, name, col) in iac-edit {
        circle((x, y), radius: 0.18, fill: col.lighten(40%), stroke: col + 1pt)
        content((x, y - 0.5), text(size: 8.5pt, fill: rgb(0, 0, 0), weight: "semibold")[#name], anchor: "north")
      }

      let design-tools = (
        (3.5, 2.8, "diagrams.net", palette.orange),
        (5.5, 2.2, "Cloudcraft", palette.orange.darken(10%)),
        (7.5, 2.8, "Lucidchart", palette.orange.lighten(10%)),
        (2.5, 1.5, "Mermaid", palette.green),
        (5.0, 1.0, "PlantUML", palette.green.darken(10%)),
        (8.0, 1.5, "Structurizr", palette.green.lighten(10%)),
      )

      for (x, y, name, col) in design-tools {
        circle((x, y), radius: 0.18, fill: col.lighten(30%), stroke: col + 1pt)
        content((x, y - 0.5), text(size: 8.5pt, fill: rgb(0, 0, 0), weight: "semibold")[#name], anchor: "north")
      }

      circle((11, 8), radius: 0.25, fill: palette.red.lighten(40%), stroke: palette.red + 2pt)
      content(
        (11, 8 - 0.6),
        align(center)[
          #set text(fill: rgb(0, 0, 0), weight: "bold")
          TerraGUI \
          #v(-18pt) \
          （本研究）
        ],
        anchor: "north",
      )
    }),
    caption: [既存ツールの位置付けと編集粒度の比較],
  ) <fig:tool-positioning>
]

== 本研究との位置付け
既存研究はInfrastructure as Code品質の観点で有用な知見を提供するが，現場での編集体験を直接改善するツールは限られている．本研究はロスレスな編集と意味的な可視化を同時に実現し，既存のGitベースの運用と両立する点に新規性がある．

= 提案システム: TerraGUI

== システム概要
TerraGUI（開発コードネーム: TerraGUI）は，ブラウザ上で動作するTerraform統合開発環境である．ユーザはプロジェクトを作成し，テンプレートから構成を開始するか，既存のHCLファイルをインポートできる．メイン画面は「アーキテクチャエディタ」と呼ばれ，左側にグラフビュー，右側にプロパティエディタまたはコードエディタを配置した2ペイン構成となっている．

システム全体の構成は @fig:system-architecture に示す．
#[
  #set text(size: 9pt)
  #let ui-col = palette.blue
  #let server-col = palette.indigo
  #let data-col = palette.green
  #let fs-col = palette.gray
  #let ext-col = palette.orange
  #figure(
    fletcher.diagram(
      node-stroke: 1pt,
      edge-stroke: 0.8pt,
      node-corner-radius: 2pt,
      node-inset: 6pt,
      spacing: (1.2em, 1.8em),
      fletcher.node(
        (0, 0),
        align(center)[#text(weight: "medium")[ユーザ]],
        name: <user>,
        width: 2.6cm,
        fill: palette.gray.lighten(80%),
      ),
      fletcher.node(
        (0, 1),
        align(center)[
          #text(weight: "medium")[TerraGUI UI] \
          React / Next.js \
          Graph View + Editor
        ],
        name: <ui>,
        width: 5.0cm,
        fill: ui-col.lighten(50%),
      ),
      fletcher.node(
        (0, 2),
        align(center)[
          #text(weight: "medium")[Server Actions] \
          HCL Engine / Graph Engine \
          Import / Template / Schema
        ],
        name: <server>,
        width: 5.2cm,
        fill: server-col.lighten(55%),
      ),
      fletcher.node(
        (-1, 3),
        align(center)[
          #text(weight: "medium")[SQLite DB] \
          プロジェクト / ログ
        ],
        name: <db>,
        width: 3.6cm,
        fill: data-col.lighten(55%),
      ),
      fletcher.node(
        (1, 3),
        align(center)[
          #text(weight: "medium")[ローカル作業領域] \
          HCL / State
        ],
        name: <workspace>,
        width: 3.8cm,
        fill: fs-col.lighten(55%),
      ),
      fletcher.node(
        (1, 2),
        align(center)[
          #text(weight: "medium")[CLI連携] \
          terraform / terracognita
        ],
        name: <cli>,
        width: 4.2cm,
        fill: ext-col.lighten(55%),
      ),
      fletcher.node(
        (1, 1),
        align(center)[
          #text(weight: "medium")[クラウドAPI] \
          AWS / GCP / Azure
        ],
        name: <cloud>,
        width: 4.0cm,
        fill: ext-col.lighten(60%),
      ),
      fletcher.edge(<user>, <ui>, "->"),
      fletcher.edge(<ui>, <server>, "<->"),
      fletcher.edge(<server>, <db>, "->"),
      fletcher.edge(<server>, <workspace>, "->"),
      fletcher.edge(<server>, <cli>, "->"),
      fletcher.edge(<cli>, <cloud>, "<->"),
    ),
    caption: [TerraGUIのシステム構成図],
  ) <fig:system-architecture>
]

== ユースケースと要件整理
TerraGUIの主な対象ユーザは，Terraformを用いてクラウド構成を設計・運用するエンジニアと，Infrastructure as Codeを学ぶ学生である．ユーザの操作シナリオは大きく3つに分かれる．

第一に，既存コードの可視化と編集である．既存のHCLファイルを読み込み，依存関係や構成全体を視覚的に把握しながら編集する．コメントやフォーマットを保持し，レビュー文化を破壊しないことが必須条件となる．第二に，既存環境のインポートである．既存クラウド環境をterracognitaによりインポートし，HCLとグラフを生成する @terracognita．インポート時のログを可視化し，失敗原因を追跡可能にする必要がある．第三に，テンプレートからの開始である．代表的な構成をテンプレートとして提供し，必要なパラメータを入力して新規プロジェクトを作成する．

これらのユースケースから，ロスレス編集，既存ワークフローとの統合，学習容易性と視認性向上，ローカル環境で完結する軽量性の4点が要件として導出される．

ユースケースと要件の対応関係は @fig:usecase-requirements にまとめる．
#[#set text(size: 9pt)
  #figure(
    table(
      columns: (2.7fr, 1.3fr, 1.7fr, 1.4fr, 1.5fr),
      table.header(
        [*ユースケース*],
        [*ロスレス編集*],
        [*既存ワークフロー* \ *との統合*],
        [*学習容易性* \ *と視認性向上*],
        [*ローカル環境で* \ *完結する軽量性*],
      ),
      [既存コードの可視化と編集], [●], [●], [●], [],
      [既存環境のインポート], [], [●], [●], [●],
      [テンプレートからの開始], [], [], [●], [●],
    ),
    caption: [ユースケースと要件の対応],
  ) <fig:usecase-requirements>
]

== システムアーキテクチャとデータフロー
システムは，フロントエンドUI，サーバー側アクション，SQLiteデータベースの3層を中心に構成される．フロントエンドではReact FlowとMonaco Editorが連携し，選択状態やハイライトを同期する．サーバー側はHCLを解析しグラフを生成し，architecture_filesテーブルにHCLテキストを保存する．インポート処理では一時ディレクトリにHCLとstateを生成し，そこから解析する．SQLiteは描画高速化と状態管理のための永続ストレージとして利用される．

DBとインポート作業領域のデータフローは @fig:dataflow-db-import に示す．
#[#set text(size: 9pt)
  #let server-col = palette.indigo
  #let data-col = palette.green
  #let fs-col = palette.gray
  #let ext-col = palette.orange
  #figure(
    fletcher.diagram(
      node-stroke: 1pt,
      edge-stroke: 0.7pt,
      node-corner-radius: 2pt,
      node-inset: 6pt,
      spacing: (1.8em, 1.6em),
      fletcher.node(
        (0, 0),
        align(center)[
          #set text(weight: "medium")
          クラウドAPI \
          #v(-18pt) \
          AWS, GCP, Azure
        ],
        name: <cloud>,
        width: 3.4cm,
        fill: ext-col.lighten(55%),
      ),
      fletcher.node(
        (1, 0),
        align(center)[
          #set text(weight: "medium")
          CLI \
          #v(-18pt) \
          terraform, terracognita
        ],
        name: <cli>,
        width: 4.2cm,
        fill: ext-col.lighten(45%),
      ),
      fletcher.node(
        (2, 0),
        align(center)[
          #set text(weight: "medium")
          インポート作業領域 \
          #v(-18pt) \
          HCL, State, Logs
        ],
        name: <workspace>,
        width: 4.2cm,
        fill: fs-col.lighten(45%),
      ),
      fletcher.node(
        (1, 1),
        align(center)[
          #set text(weight: "medium")
          解析・変換 \
          #v(-18pt) \
          HCL Engine, Graph Engine
        ],
        name: <engine>,
        width: 4.8cm,
        fill: server-col.lighten(45%),
      ),
      fletcher.node(
        (2, 1),
        align(center)[
          #set text(weight: "medium")
          SQLiteデータベース \
          #v(-18pt) \
          architecture_files \
          #v(-18pt) \
          architecture_imports \
          #v(-18pt) \
          architecture_import_logs
        ],
        name: <db>,
        width: 4.7cm,
        fill: data-col.lighten(45%),
      ),
      fletcher.edge(<cloud>, <cli>, "<->"),
      fletcher.edge(<cli>, <workspace>, "->"),
      fletcher.edge(<workspace>, <engine>, "->"),
      fletcher.edge(<engine>, <db>, "->"),
    ),
    caption: [DBとインポート作業領域のデータフロー],
  ) <fig:dataflow-db-import>
]

== 設計思想

=== Single Source of Truth as Code
TerraGUIはHCLテキストを単一の真実源として扱い，architecture_filesテーブルに保存された内容を基準に動作する．graph_jsonはあくまで派生データであり，必要に応じて再生成できる．この設計により，UI上の編集結果は常にHCLテキストに反映され，視覚的な操作とコードの整合性が維持される．

=== ロスレス編集
GUIツールが普及しない最大の要因は，勝手にコードを書き換えられることへの嫌悪感である．TerraGUIは，ユーザが意図的に変更したパラメータ以外には一切手を加えない．これを実現するために，HCLの解析と再生成のプロセスにおいて完全な可逆性を保証するアーキテクチャを採用した．

=== 意味的階層化
クラウドインフラストラクチャには，VPCの中にサブネットがあり，サブネットの中にインスタンスがあるといった包含関係が存在する．しかしHCLの構文上は，これらは全て並列なresourceブロックとして記述される．TerraGUIはリソースの属性を解析し，UI上で自動的に親子関係を構築して表示する．これにより，ユーザはメンタルモデルに近い形でインフラストラクチャを把握できる．

=== ローカルファーストと拡張性
ローカル環境での利用を前提とし，DockerやDev Containersで容易に起動できる．また，プロバイダスキーマやアイコンを自動更新する仕組みにより，クラウドサービスの更新に追従可能とする．

意味的階層化の概念は @fig:semantic-layering で可視化する．
#[#set text(size: 9pt)
  #figure(
    cetz.canvas({
      import cetz.draw: *

      let panel-fill = palette.gray.lighten(85%)
      let panel-stroke = palette.gray.lighten(7%)
      let hcl-col = palette.gray.darken(20%)
      let vpc-col = palette.blue
      let subnet-col = palette.green
      let instance-col = palette.orange

      rect((-6.54, -6.4), (-1.14, 0), fill: panel-fill, stroke: panel-stroke + 1pt, radius: 0.12)
      rect((1.14, -6.4), (6.54, 0), fill: panel-fill, stroke: panel-stroke + 1pt, radius: 0.12)

      content((-3.84, -0.3), align(center)[#text(weight: "bold")[HCLのフラット記述]], anchor: "center")
      content((3.84, -0.3), align(center)[#text(weight: "bold")[意味的階層化された構造]], anchor: "center")

      rect((-5.84, -1.6), (-1.84, -0.8), fill: hcl-col.lighten(55%), stroke: hcl-col + 1pt, radius: 0.12)
      rect((-5.84, -2.7), (-1.84, -1.9), fill: hcl-col.lighten(55%), stroke: hcl-col + 1pt, radius: 0.12)
      rect((-5.84, -3.8), (-1.84, -3.0), fill: hcl-col.lighten(55%), stroke: hcl-col + 1pt, radius: 0.12)
      rect((-5.84, -4.9), (-1.84, -4.1), fill: hcl-col.lighten(55%), stroke: hcl-col + 1pt, radius: 0.12)

      content((-3.84, -1.2), align(center)[VPC], anchor: "center")
      content((-3.84, -2.3), align(center)[Subnet A], anchor: "center")
      content((-3.84, -3.4), align(center)[Subnet B], anchor: "center")
      content((-3.84, -4.5), align(center)[Instance], anchor: "center")

      rect((1.64, -5.7), (6.04, -0.8), fill: vpc-col.lighten(60%), stroke: vpc-col + 1pt, radius: 0.14)
      content((3.84, -1.1), align(center)[#text(weight: "bold")[VPC]], anchor: "center")

      rect((2.14, -3.8), (5.54, -1.8), fill: subnet-col.lighten(55%), stroke: subnet-col + 1pt, radius: 0.12)
      rect((2.14, -5.3), (5.54, -4.0), fill: subnet-col.lighten(55%), stroke: subnet-col + 1pt, radius: 0.12)
      content((3.84, -2.3), align(center)[Subnet A], anchor: "center")
      content((3.84, -4.4), align(center)[Subnet B], anchor: "center")

      rect((2.74, -3.4), (4.94, -2.6), fill: instance-col.lighten(55%), stroke: instance-col + 1pt, radius: 0.12)
      content((3.84, -3.0), align(center)[Instance], anchor: "center")

      line((-1.14, -2.9), (1.14, -2.9), stroke: palette.gray.darken(45%) + 0.9pt, mark: (end: "stealth"))
      content((0, -2.45), align(center)[解析・階層化], anchor: "center")
    }),
    caption: [意味的階層化の概念図],
  ) <fig:semantic-layering>
]

= 実装詳細

本章では，TerraGUIの中核となる2つのエンジン，HCL EngineとGraph Engineの実装詳細について述べる．

== プロジェクト構造とモジュール境界
アプリケーションはNext.js App Routerを基盤とし，src/app配下に画面とServer Actionsが配置される．トップページや新規作成フローはsrc/app/newに集約され，インポートのUIとアクションはsrc/app/new/import以下に分離されている．アーキテクチャ編集画面はsrc/app/architecture/\[architecture\]にあり，グラフキャンバス，コードエディタ，プロパティエディタなどのコンポーネントが\_components以下に集約される．

コアロジックはsrc/libに集約し，HCLの解析とロスレス再生成はsrc/lib/hcl.ts，グラフ変換と意味的階層化はsrc/lib/graph.tsが担当する．データベース定義はsrc/db/schemaにあり，プロジェクト情報，テンプレート，インポートログ，プロバイダスキーマが独立したテーブルとして定義される．アイコン生成やデータ初期化のワークフローはsrc/workflowsに配置され，src/workflows/icon.tsがクラウド公式アイコンの収集とマッピングを担う．

プロジェクト構造と主要モジュールの対応は @fig:project-structure に示す．
#[#set text(size: 9pt)
  #figure(
    table(
      columns: (1.4fr, 2.6fr),
      table.header([*パス*], [*役割・主要モジュール*]),
      [`src/app`], [画面とServer Actionsの基盤],
      [`src/app/new`], [トップページ／新規作成フロー],
      [`src/app/new/import`], [インポートUIとアクション],
      [`src/app/architecture/[architecture]`], [アーキテクチャエディタ画面],
      [`src/app/architecture/[architecture]/_components`], [グラフキャンバス／コード／プロパティ],
      [`src/lib`], [共有ユーティリティとドメインロジック],
      [`src/lib/hcl.ts`], [HCL解析とロスレス再生成],
      [`src/lib/graph.ts`], [グラフ変換と意味的階層化],
      [`src/db/schema`], [DBスキーマ（プロジェクト／テンプレート／ログ／スキーマ）],
      [`src/workflows`], [ワークフロー定義と自動化],
      [`src/workflows/icon.ts`], [クラウド公式アイコンの収集とマッピング],
    ),
    caption: [プロジェクト構造と主要モジュールの対応],
  ) <fig:project-structure>
]

== HCL Engineの実装
HCL Engineは，src/lib/hcl.tsに実装されており，テキストと具象構文木の相互変換を担う．

=== トークン定義と字句解析
HCLを構成する要素をTokenとして定義する．typescript-parsecを用い，正規表現ベースのルールで字句解析する．重要な点は，空白やコメントもトークンとして保持することである．また，HCLの仕様に沿って文字列リテラル，数値リテラル，ブロックコメント，ヒアドキュメントなどを個別トークンとして扱う @hclspec @typescript_parsec．

```typescript
export enum HclTokenKind {
  Whitespace,
  LineComment,
  HashComment,
  BlockComment,
  Identifier,
  NumberLiteral,
  BooleanLiteral,
  NullLiteral,
  StringLiteral,
  HeredocLiteral,
  Equals,
  Colon,
  // ...
}
```

本実装では，文書全体を対象とするレキサーと，式解析専用のレキサーを分離している．前者は空白・コメントをトークンとして保持し，後者は式の評価に不要なトークンをスキップする設計である．これにより，属性値の境界を正確に特定しつつ，ロスレス編集に必要な文書全体のトークン列を維持できる．Heredocや文字列リテラルのデコード処理も字句解析段階で扱い，後段の式評価で正規化が進み過ぎないように調整している．

=== 構文解析と具象構文木構築
字句解析されたトークン列から，HclDocumentとして具象構文木を構築する．具象構文木はノードの配列であり，各ノードは元のテキスト上の位置範囲を持つ．parseBody関数はトークン列を逐次走査し，属性とブロックを判定する．この過程では，行末のコメントや改行の扱いを考慮し，属性値の境界を厳密に検出する．

HCLトークンからCST生成までの処理フローは @fig:hcl-cst-flow に整理する．
#[#set text(size: 9pt)
  #let flow-col = palette.indigo
  #let data-col = palette.green
  #figure(
    fletcher.diagram(
      node-stroke: 1pt,
      edge-stroke: 0.7pt,
      node-corner-radius: 2pt,
      node-inset: 6pt,
      spacing: (1.2em, 1.4em),
      fletcher.node(
        (0, 0),
        align(center)[
          #set text(weight: "medium")
          HCLテキスト
        ],
        name: <hcl-text>,
        width: 3.2cm,
        fill: data-col.lighten(50%),
      ),
      fletcher.node(
        (0, 1),
        align(center)[
          #set text(weight: "medium")
          字句解析 \
          #v(-18pt) \
          トークナイザ
        ],
        name: <tokenizer>,
        width: 3.4cm,
        fill: flow-col.lighten(50%),
      ),
      fletcher.node(
        (0, 2),
        align(center)[
          #set text(weight: "medium")
          トークン列 \
          #v(-18pt) \
          コメント・空白保持
        ],
        name: <tokens>,
        width: 3.8cm,
        fill: data-col.lighten(50%),
      ),
      fletcher.node(
        (0, 3),
        align(center)[
          #set text(weight: "medium")
          構文解析 \
          #v(-18pt) \
          ts-parsec
        ],
        name: <parser>,
        width: 3.4cm,
        fill: flow-col.lighten(50%),
      ),
      fletcher.node(
        (0, 4),
        align(center)[
          #set text(weight: "medium")
          CST \
          #v(-18pt) \
          トークン完全保持
        ],
        name: <cst>,
        width: 3.2cm,
        fill: data-col.lighten(50%),
      ),
      fletcher.edge(<hcl-text>, <tokenizer>, "->"),
      fletcher.edge(<tokenizer>, <tokens>, "->"),
      fletcher.edge(<tokens>, <parser>, "->"),
      fletcher.edge(<parser>, <cst>, "->"),
    ),
    caption: [HCLトークンからCST生成までの処理フロー],
  ) <fig:hcl-cst-flow>
]

この構造により，例えばami属性の値を書き換える操作は，Attributeノードのexpression部分に対応するトークンを置換する操作として実装できる．それ以外のトークンはそのまま維持されるため，ロスレスな編集が可能となる．

=== 式構文と演算子優先順位
HCLの式は算術演算子，論理演算子，条件演算子，nullish演算子など多様な構文を含む @terraform_expressions．実装ではlrec_scを用いた左再帰パーサを多段に構成し，算術演算子，比較演算子，論理演算子，条件演算子といった優先順位を明示的に表現している．また，タプル/オブジェクト，関数呼び出し，インデックス参照，属性アクセス，スプラット式までを式ノードとして扱うことで，Terraformの評価モデルに沿った構文木を構成する．

for式や条件式は，リソース定義の属性値だけでなくdynamicブロックによる繰り返し構造にも影響するため，GUI編集での参照解決や依存抽出にも影響する @terraform_dynamic_blocks．TerraGUIでは式ノードを保持したままグラフ解析に渡すことで，依存関係抽出とロスレス編集の両立を図っている．

=== 差分適用とロスレス再生成
編集時には，対象ブロックのトークン範囲のみを書き換え，それ以外はそのまま保持する．値更新はvalueRangeを基準に行い，必要に応じて未定義属性を末尾へ挿入する．astToHclはトークンを連結するだけで再生成できるため，元の書式が維持される．この方式により，GUI側の編集が最小差分としてコードに反映される．

具体的には，ブロック内部のトークンを複製し，更新対象の値トークンだけを書き換え，残りのトークンを空文字にすることで差分の最小化を実現する．新規属性は末尾の閉じ括弧を検出して適切なインデントを推定し，既存のコードスタイルを崩さないように挿入される．このアプローチにより，レビュー時に差分が最小化され，チーム内のコードスタイルの一貫性が保たれる．

== Graph Engineの実装
Graph Engineはsrc/lib/graph.tsに実装されており，具象構文木からグラフ構造への変換を担う．

=== ノード変換と親子関係の構築
HCLのresourceブロックを解析し，React Flowのノードへ変換する．リソースはresourceTypeとnameの組をアドレスとして扱い，同一アドレスが複数存在する場合は識別子にサフィックスを付与する．

ここで最も重要な処理が親子関係の構築である．HCL上ではフラットに記述されているリソースに対し，以下の優先順位でグルーピングを行う．最優先はAvailability Zoneであり，availability_zone属性を持つリソースが対象となる．次にSubnetであり，subnet_id属性を持つリソースが対象となる．続いてVPCであり，vpc_id属性を持つリソースが対象となる．最後にProvider/Regionであり，プロバイダ設定に基づくリージョンが対象となる．

この際，collectReferencedResourceIdsにより参照先リソースを解決し，親候補と優先度を比較して決定する．また，Availability Zoneからリージョンを逆算し，プロバイダ設定が省略されている場合でもグルーピングできるようにしている．

プロバイダブロックは独立ノード化され，リージョンが指定されている場合は仮想グループが生成される．これにより，VPCやサブネットが存在しない構成でも，プロバイダ単位の階層を維持できる．セキュリティグループやサブネットグループといった実体のある集約リソースは実グループとして扱い，Availability Zoneやリージョンは仮想グループとして扱うことで，論理的な境界と物理的な境界を視覚的に区別する．

=== 依存関係抽出
依存関係は2種類に分けて抽出する．第一に，depends_onに明示的に列挙された依存である．第二に，属性値内の参照式である．

参照式の抽出には，式木からアクセスチェーンを辿るunwrapAccessChainを用いる．配列やオブジェクトのネストを含む場合でも，式木を走査して参照先IDを収集する．

depends_onはTerraformのメタ引数として明示的な依存関係を表すため，Graph Engineでは最優先のエッジ生成対象として扱う @terraform_meta_arguments．一方で，式内参照は暗黙的な依存であり，関数呼び出しや条件式を含む場合もあるため，式木を再帰的に探索して参照先を抽出する．この処理により，単純な属性参照だけでなく，配列のインデックスアクセスやfor式による集合生成など，実運用で頻出する表現に対しても依存関係を補足できる．

参照式と依存エッジ生成の処理は @fig:reference-edge-flow に示す．
#[#set text(size: 9pt)
  #let flow-col = palette.indigo
  #let data-col = palette.green
  #figure(
    fletcher.diagram(
      node-stroke: 1pt,
      edge-stroke: 0.7pt,
      node-corner-radius: 2pt,
      node-inset: 6pt,
      spacing: (1.4em, 1.2em),
      fletcher.node(
        (0, 0),
        align(center)[
          #set text(weight: "medium")
          HCL属性値 \
          #v(-18pt) \
          式ツリー
        ],
        name: <expr-tree>,
        width: 3.6cm,
        fill: data-col.lighten(50%),
      ),
      fletcher.node(
        (0, 1),
        align(center)[
          #set text(weight: "medium")
          参照式抽出 \
          #v(-18pt) \
          traversal
        ],
        name: <extract>,
        width: 3.8cm,
        fill: flow-col.lighten(50%),
      ),
      fletcher.node(
        (0, 2),
        align(center)[
          #set text(weight: "medium")
          アドレス解析 \
          #v(-18pt) \
          resource/type/name
        ],
        name: <address>,
        width: 4.1cm,
        fill: flow-col.lighten(50%),
      ),
      fletcher.node(
        (0, 3),
        align(center)[
          #set text(weight: "medium")
          依存エッジ生成 \
          #v(-18pt) \
          Graph JSON
        ],
        name: <edge>,
        width: 3.9cm,
        fill: data-col.lighten(50%),
      ),
      fletcher.node(
        (1, 2),
        align(center)[
          #set text(weight: "medium")
          リソース定義一覧 \
          #v(-18pt) \
          ノードID
        ],
        name: <resource-list>,
        width: 3.8cm,
        fill: data-col.lighten(50%),
      ),
      fletcher.edge(<expr-tree>, <extract>, "->"),
      fletcher.edge(<extract>, <address>, "->"),
      fletcher.edge(<address>, <edge>, "->"),
      fletcher.edge(<resource-list>, <address>, "->"),
    ),
    caption: [参照式と依存エッジ生成の処理],
  ) <fig:reference-edge-flow>
]

=== エッジ生成と自動レイアウト
依存関係を表すエッジは，depends_on属性や参照式から生成される．生成されたノードとエッジの配置計算にはelkjsを使用している．ELKのlayeredアルゴリズムを採用し，上から下へのレイアウトやネスト構造の維持といったオプションを設定することで，複雑な依存関係を持つグラフでも交差が少なく，視認性の高い配置を実現している @elkjs．

レイアウト結果はReact Flowの座標系に変換され，エッジの曲がり点（bend points）やラベル配置も保持される．エッジラベルは依存関係のインデックスや参照経路を表現するために利用し，視覚的な説明性を補強する．また，グループノードには内側のパディングや最小サイズを設定し，子ノードが重ならないように調整している．

=== ノード種別とUIへの写像
UI上ではノードをresource，group-real，group-virtualに分類する．VPCやSubnetなど，実体としてのまとまりを持つリソースはgroup-realとして描画し，Availability ZoneやRegionなど論理的な区分はgroup-virtualとして表現する．この区別により，物理的リソースと論理的境界を視覚的に区別できる．

さらに，ドキュメント全体のトークン列を保持するdocumentノードと，プロバイダ設定を表すproviderノードを内部的に管理する．documentノードは順序情報や原文テキストを保持し，ロスレス再生成に不可欠なメタデータを担う．providerノードはリージョン推論やグルーピングに利用され，UI上ではグループと同等の扱いで折り畳み可能な構造として扱われる．

== Text-Graph Sync
グラフ上のノードとコードエディタの対応付けは，トークン位置情報を用いて実現する．各ブロックのheaderRangeをオフセットとして記録し，Monaco Editor上のカーソル移動に応じて該当ノードをハイライトする．逆方向の同期では，ノード選択時にコードエディタをスクロールし，対応するブロックを中央に表示する．

コードとグラフの双方向同期は @fig:text-graph-sync で整理する．
#[#set text(size: 9pt)
  #let ui-col = palette.blue
  #let flow-col = palette.indigo
  #let data-col = palette.green
  #figure(
    fletcher.diagram(
      node-stroke: 1pt,
      edge-stroke: 0.7pt,
      node-corner-radius: 2pt,
      node-inset: 6pt,
      spacing: (1.2em, 1.2em),
      fletcher.node(
        (0, 0),
        align(center)[
          #set text(weight: "medium")
          コードエディタ \
          #v(-18pt) \
          HCLテキスト
        ],
        name: <code>,
        width: 3.8cm,
        fill: data-col.lighten(50%),
      ),
      fletcher.node(
        (0, 1),
        align(center)[
          #set text(weight: "medium")
          HCL Engine \
          #v(-18pt) \
          CST生成・差分更新
        ],
        name: <hcl-engine>,
        width: 4.2cm,
        fill: flow-col.lighten(50%),
      ),
      fletcher.node(
        (0, 2),
        align(center)[
          #set text(weight: "medium")
          Graph Engine \
          #v(-18pt) \
          Graph JSON生成
        ],
        name: <graph-engine>,
        width: 4.2cm,
        fill: flow-col.lighten(50%),
      ),
      fletcher.node(
        (0, 3),
        align(center)[
          #set text(weight: "medium")
          グラフビュー \
          #v(-18pt) \
          React Flow
        ],
        name: <graph-view>,
        width: 3.8cm,
        fill: ui-col.lighten(50%),
      ),
      fletcher.edge(<code>, <hcl-engine>, "<->"),
      fletcher.edge(<hcl-engine>, <graph-engine>, "<->"),
      fletcher.edge(<graph-engine>, <graph-view>, "<->"),
    ),
    caption: [コードとグラフの双方向同期],
  ) <fig:text-graph-sync>
]

コード側の編集が発生した場合は，hclToAstで再解析した後，astToReactFlowにより再度グラフを構築する．この際，既存のノード位置をmergeGraphWithExistingにより引き継ぎ，視覚的な配置が不用意にリセットされないようにしている．逆にグラフ側の編集はreactFlowToAstを介してHCLへ反映し，astToHclによりトークンを再結合することでロスレスな反映を担保する．

== プロパティエディタの実装
プロパティエディタは，選択されたリソースの属性を編集するためのUIである．

=== スキーマ駆動フォーム
Terraformのリソースには数百の属性が存在しうるため，これらを静的に定義できない．本システムでは，バックエンドでTerraformプロバイダのスキーマ情報を取得し，それをフロントエンドに送信する @terraform_providers_schema．フロントエンドでは，スキーマ情報に基づいて，動的にフォームフィールドをレンダリングする．

```typescript
{field.input === "boolean" ? (
  <Switch ... />
) : field.input === "textarea" ? (
  <Textarea ... />
) : (
  <Input ... />
)}
```

属性型の判定にはbool，number，stringといったスキーマ型を利用し，配列や複合型はテキストエリアとして扱う．さらに，既存のHCLから属性値を抽出し，初期値としてフォームに反映することで，コードとフォームの同期を維持する．

変更内容はreact-hook-formで管理され，デバウンス処理を経て，Server Actions経由でHCLファイルに書き込まれる @react_hook_form．スキーマ取得はfetchProviderSchemaを通じて行われ，取得結果はクライアント側でキャッシュされるため，同一プロバイダのリソース編集時に再取得が発生しにくい．

== アイコン自動生成
クラウドリソースは数千種類に及ぶため，手動でのアイコン対応付けは困難である．本システムではsrc/workflows/icon.tsを用い，Amazon Web Services，Google Cloud Platform，Microsoft Azureの公式アイコンセットを自動収集し，Terraformのリソース名とファイル名のトークン類似度に基づいて動的にマッピングする @aws_arch_icons @gcp_arch_icons @azure_arch_icons．具体的には，Terraform CLIのproviders schema -jsonによってプロバイダのリソース一覧を取得し，リソース名をトークン化してアイコン名と照合する @terraform_providers_schema．

スコアリングでは一致トークン数を基本とし，先頭トークン一致やファイル名の連結一致を加点する．解決したアイコンはmap.jsonに保存し，UI側ではリソースタイプ名から即座にアイコンパスを決定できる．この方式により，プロバイダの更新やリソース追加にも柔軟に追従できる．

アイコン自動生成のパイプラインは @fig:icon-pipeline に示す．
#[#set text(size: 9pt)
  #let flow-col = palette.indigo
  #let data-col = palette.green
  #let ext-col = palette.orange
  #figure(
    fletcher.diagram(
      node-stroke: 1pt,
      edge-stroke: 0.7pt,
      node-corner-radius: 2pt,
      node-inset: 6pt,
      spacing: (1.4em, 1.2em),
      fletcher.node(
        (0, 0),
        align(center)[
          #set text(weight: "medium")
          公式アイコン \
          #v(-18pt) \
          AWS / Azure / GCP
        ],
        name: <vendor-icons>,
        width: 3.8cm,
        fill: ext-col.lighten(55%),
      ),
      fletcher.node(
        (0, 1),
        align(center)[
          #set text(weight: "medium")
          収集・抽出 \
          #v(-18pt) \
          src/scripts/icon.ts
        ],
        name: <collector>,
        width: 4.0cm,
        fill: flow-col.lighten(50%),
      ),
      fletcher.node(
        (0, 2),
        align(center)[
          #set text(weight: "medium")
          正規化・命名 \
          #v(-18pt) \
          プロバイダ別変換
        ],
        name: <normalize>,
        width: 4.0cm,
        fill: flow-col.lighten(50%),
      ),
      fletcher.node(
        (0, 3),
        align(center)[
          #set text(weight: "medium")
          SVGR変換 \
          #v(-18pt) \
          Reactコンポーネント
        ],
        name: <svgr>,
        width: 4.0cm,
        fill: flow-col.lighten(50%),
      ),
      fletcher.node(
        (0, 4),
        align(center)[
          #set text(weight: "medium")
          アイコン出力 \
          #v(-18pt) \
          src/app/architecture/.../icons
        ],
        name: <icons>,
        width: 4.2cm,
        fill: data-col.lighten(50%),
      ),
      fletcher.edge(<vendor-icons>, <collector>, "->"),
      fletcher.edge(<collector>, <normalize>, "->"),
      fletcher.edge(<normalize>, <svgr>, "->"),
      fletcher.edge(<svgr>, <icons>, "->"),
    ),
    caption: [アイコン自動生成パイプライン],
  ) <fig:icon-pipeline>
]

== データベース連携
SQLiteを用いてプロジェクト情報，アーキテクチャ，インポートログ，プロバイダスキーマを保持する．architecturesテーブルはプロジェクトメタデータを保持し，architecture_filesテーブルがHCLコードの本体を保持する．architecture_importsテーブルとarchitecture_import_logsテーブルはインポートの状態とログストリームを管理し，provider_schemasテーブルはプロバイダスキーマをバージョン付きでキャッシュする．テンプレート機能はtemplatesテーブル，template_parametersテーブル，template_tagsテーブルに分割され，テンプレートの入力仕様を正規化して保持する．

architecturesテーブルのgraph_jsonは描画キャッシュとして保存されるため，グラフの再レンダリングが高速化される．保存時にはトランザクションを用いてgraph_jsonとarchitecture_filesテーブルの更新を同期し，UIとコードの整合性を確保する．

= ユーザインターフェースとワークフロー

本章では，TerraGUIが提供する主要な機能とUIについて紹介する．

== 画面構成とナビゲーション
トップページではプロジェクト一覧を表示し，新規作成，テンプレート作成，既存環境インポートへの導線を提供する．各プロジェクトは名称と概要を持ち，選択するとアーキテクチャエディタへ遷移する．

トップページとプロジェクト一覧の構成は @fig:ui-top で確認できる．
#figure(image("./ui-top.png", width: 100%), caption: [トップページとプロジェクト一覧]) <fig:ui-top>

一覧画面には検索バーとタイプフィルタが用意され，プロジェクト名や説明文に対する部分一致検索が可能である．更新日時のソートやタイプ別の絞り込みにより，プロジェクト数が増加しても必要な構成を迅速に特定できる．

== プロジェクト作成とテンプレート
プロジェクト作成フローは，テンプレート起点・インポート起点・スクラッチ起点の3方式を提供する．それぞれの選択肢は新規作成画面で一覧化され，初心者でも迷わず導線を辿れるように設計されている．

=== 新規作成の入口
新規作成画面では「From Templates」「From Existing Infra」「From Scratch」をカード形式で表示し，目的に応じた入口を明確にする．ここでの選択は後続のフォームやインポート処理に直結するため，UI上で選択肢の説明文を明示することでミスを防ぐ．

新規作成の入口画面は @fig:ui-new-entry に示す．
#figure(image("./ui-new-entry.png", width: 100%), caption: [新規作成の入口画面]) <fig:ui-new-entry>

=== テンプレート一覧
テンプレート一覧では検索とフィルタが可能であり，テンプレート名・概要・タグを横断的に検索できる．プロバイダ別の絞り込みと作成日時のソートにより，多数のテンプレートから目的の構成を素早く見つけられる．テンプレートはDB上のtemplatesテーブルとtemplate_tagsテーブルによって管理されるため，タグ分類を柔軟に拡張できる．

テンプレート一覧と検索フィルタの構成は @fig:ui-template-list に示す．
#figure(image("./ui-template-list.png", width: 100%), caption: [テンプレート一覧と検索フィルタ]) <fig:ui-template-list>

=== テンプレート詳細設定
テンプレート詳細画面では，パラメータフォームを通じて環境名やCIDR，リージョンなどを入力する．入力フォームはreact-hook-formとzodによって検証され，必須項目や形式不一致を即座に通知できる @react_hook_form @zod．テンプレートの説明文やタグも同時に表示されるため，構成内容を理解した上で作成できる．

テンプレート詳細とパラメータ入力の画面は @fig:ui-template-detail に示す．
#figure(
  image("./ui-template-detail.png", width: 100%),
  caption: [テンプレート詳細とパラメータ入力],
) <fig:ui-template-detail>

=== スクラッチ作成
スクラッチ作成は最小限のフォーム入力で開始できる．名称と概要のみを指定し，空の構成を生成することで，試行錯誤しながらリソースを追加するワークフローを支援する．

スクラッチ作成フォームの構成は @fig:ui-scratch に示す．
#figure(image("./ui-scratch.png", width: 100%), caption: [スクラッチ作成フォーム]) <fig:ui-scratch>

== 既存環境のインポート
インポートは「ローカルファイルからの取り込み」と「クラウド環境からの取り込み」に分かれる．どちらもプロジェクト作成フローの一部として実行され，完了後は自動的にアーキテクチャエディタへ移行する．

=== インポート元選択
インポート元選択画面では，ローカルファイルとクラウドインポートの2択を提示する．クラウドインポートはterracognitaとクラウドCLIの可用性が確認できた場合のみ表示されるため，環境差によるエラーを事前に抑制できる @terracognita @aws_cli @gcloud_cli @azure_cli．

インポート元の選択画面は @fig:ui-import-source に示す．
#figure(image("./ui-import-source.png", width: 100%), caption: [インポート元の選択画面]) <fig:ui-import-source>

=== ローカルファイルインポート
ローカルインポートでは.tfと.tfvarsを複数選択し，プロジェクト名と概要を入力してアップロードする．react-hook-formとzodで入力を検証し，ファイル未選択時にはエラーを表示する @react_hook_form @zod．設計上はインポート後にHCLを解析しグラフを生成し，最初の編集状態を自動生成することを想定している．現段階ではUIと入力検証の整備を優先し，ファイル内容の取り込みは今後の拡張課題とする．

ローカルファイルの選択と検証の流れは @fig:ui-import-local に示す．
#figure(image("./ui-import-local.png", width: 100%), caption: [ローカルファイルの選択と検証]) <fig:ui-import-local>

=== クラウドインポート
クラウドインポートではAmazon Web Services，Google Cloud Platform，Microsoft Azureのいずれかを選択し，プロバイダごとに必要な認証情報を入力する．Amazon Web Servicesはアクセスキー方式とプロフィール方式を切り替えられ，Google Cloud Platformはサービスアカウントキー，Microsoft Azureはサービスプリンシパル方式を採用する．入力値はCLIを用いて検証し，認証が通った場合のみterracognitaを実行する @terracognita @aws_cli @gcloud_cli @azure_cli．

クラウドインポートの入力フォームは @fig:ui-import-cloud に示す．
#figure(image("./ui-import-cloud.png", width: 100%), caption: [クラウドインポートの入力フォーム]) <fig:ui-import-cloud>

=== インポートログ監視
インポート実行中はログパネルに切り替わり，標準出力/標準エラーのログがストリームとして表示される．ステータスバッジにより進行状態を可視化し，成功時は自動的にエディタ画面へ遷移する．ログの自動スクロールとエラーメッセージの強調表示により，失敗時の原因特定を支援する．

インポートログとステータス表示は @fig:ui-import-log-status に示す．
#figure(
  image("./ui-import-log-status.png", width: 100%),
  caption: [インポートログとステータス表示],
) <fig:ui-import-log-status>

== アーキテクチャエディタ
メイン画面は，グラフ操作を中心としたIDEのような構成である．左側にはリソースノードが表示される領域であるCanvasがあり，ズームやパンが可能である．右側にはDetail Panelがあり，プロパティエディタやコードエディタを切り替えて表示する．

レイアウトはAllotmentにより左右2ペインで構成され，ユーザは編集対象に応じてパネル幅を調整できる @allotment．キャンバスではスペースキーによるパンモードが有効になり，ノードのドラッグとビュー操作を切り替えられる．選択中のノードは右ペインに反映され，プロパティ編集とコード編集をワンクリックで切り替えられる．

保存状態はヘッダのステータス表示で可視化される．自動保存が走ると「Saving...」が表示され，完了すると「Auto-saved」に切り替わるため，ユーザは明示的な保存操作を意識せずに作業できる．

アーキテクチャエディタの全体像は @fig:ui-arch-editor に示す．
#figure(
  image("./ui-arch-editor.png", width: 100%),
  caption: [アーキテクチャエディタの全体像],
) <fig:ui-arch-editor>

== カスタムノードとアイコン
グラフ上のノードは，React Flowのカスタムノードとして実装されている @xyflow．各リソースアイコンは，Amazon Web Services，Google Cloud Platform，Microsoft Azureの公式アイコンセットを使用しており，リソースタイプ名から動的にアイコンファイルを解決して表示する @aws_arch_icons @gcp_arch_icons @azure_arch_icons．また，グループノードは，内部に他のノードを含むコンテナとして描画され，ドラッグ操作でグループごと移動できる．

仮想グループ（リージョンやAvailability Zone）も同一のレイアウト体系で扱い，UI上では背景色とラベルで区別する．これにより，物理的なネットワーク階層と論理的なスコープが同時に把握できる．

== コード連携 (Text-Graph Sync)
グラフ上のノードを選択すると，右側のコードエディタが自動的にスクロールし，該当するリソースブロックにハイライト表示する．逆に，コードエディタ上でカーソルを移動すると，グラフ上の対応するノードがフォーカスされる．この機能により，ユーザは「今どのリソースを編集しているか」を常に意識することなく，グラフィカルな操作と詳細なコード編集を行き来できる．

コードエディタとの同期表示は @fig:ui-code-sync に示す．
#figure(
  image("./ui-code-sync.png", width: 100%),
  caption: [コードエディタとの同期表示],
) <fig:ui-code-sync>

Monaco Editorのスクロールとハイライトは，ブロックのトークン位置から計算されるため，コメントや空行が混在する現実的なコードでも精度が高い．ノード選択とコード選択が連動することで，レビュー時のトレーサビリティが向上し，「このコードがどのノードか」を視覚的に確認できる．

== プロパティエディタ
プロパティエディタはスキーマ駆動でフォームを生成し，必要項目，型，説明文を表示する．属性の編集結果はデバウンス付きで保存され，最小差分としてHCLテキストに反映される．

プロパティエディタの動的フォームは @fig:ui-property-editor に示す．
#figure(
  image("./ui-property-editor.png", width: 100%),
  caption: [プロパティエディタの動的フォーム],
) <fig:ui-property-editor>

フォームには必須/任意の区別や説明文が表示されるため，Terraformの詳細仕様を参照しなくても編集できる．ブール値にはトグルを用い，数値・文字列・複合型は入力形式を切り替えることで，初心者にも理解しやすいUIとなっている．

== Apply / Destroy（クラウド反映）
HCL内にプロバイダブロックが存在する場合，ヘッダ右上に「Apply to Cloud」ボタンが表示される．stateが検出できる場合は「Destroy from Cloud」も有効になり，既存リソースの破棄フローへ進める．ユーザ操作としては「Apply to Cloud」→ 認証情報入力 →「Plan」→ 差分確認 →「Apply」という二段階の流れになる．

認証情報入力モーダルでは，AWS/GCP/Azureのうち利用中のプロバイダのみが表示され，必要な認証情報を入力する．入力後に「Plan」を押すと，同一モーダル内でPlanログがストリーミングされ，Planの要約（追加・変更・削除件数）とResource Changes一覧が表示される．ユーザは差分内容を確認した上で「Apply」を実行する．

Applyフローの認証情報入力とPlan実行画面は @fig:ui-apply-credentials に示す．Plan結果の要約と差分一覧は @fig:ui-apply-plan-result に示す．
#figure(
  image("./ui-apply-credentials.png", width: 100%),
  caption: [Apply to Cloudの認証情報入力とPlan実行],
) <fig:ui-apply-credentials>
#figure(
  image("./ui-apply-plan-result.png", width: 100%),
  caption: [Plan結果の要約とResource Changes一覧],
) <fig:ui-apply-plan-result>

= データ管理と運用

== データモデル
データベースは，architecturesテーブル，architecture_filesテーブル，architecture_importsテーブル，provider_schemasテーブルなどで構成される．architecture_filesテーブルがHCLの本体を保持し，graph_jsonは描画キャッシュとして保存される．

データベースのER図は @fig:db-er に示す．
#[#set text(size: 8.2pt)
  #let core-col = palette.blue
  #let process-col = palette.green
  #let template-col = palette.orange
  #let misc-col = palette.gray
  #figure(
    fletcher.diagram(
      node-stroke: 1pt,
      edge-stroke: 0.7pt,
      node-corner-radius: 2pt,
      node-inset: 6pt,
      spacing: (1.6em, 1.2em),
      fletcher.node(
        (0, 0),
        align(left)[
          #align(center)[#text(weight: "medium")[templates]] \
          #v(-30pt) \
          id (PK) \
          slug \
          provider
        ],
        name: <templates>,
        width: 4.0cm,
        fill: template-col.lighten(55%),
      ),
      fletcher.node(
        (0, 1),
        align(left)[
          #align(center)[#text(weight: "medium")[template_parameters]] \
          #v(-30pt) \
          id (PK) \
          template_id (FK) \
          key
        ],
        name: <template-params>,
        width: 4.0cm,
        fill: template-col.lighten(60%),
      ),
      fletcher.node(
        (0, 2),
        align(left)[
          #align(center)[#text(weight: "medium")[template_tags]] \
          #v(-30pt) \
          id (PK) \
          template_id (FK) \
          tag
        ],
        name: <template-tags>,
        width: 4.0cm,
        fill: template-col.lighten(60%),
      ),
      fletcher.node(
        (1, 1),
        align(left)[
          #align(center)[#text(weight: "medium")[architectures]] \
          #v(-30pt) \
          id (PK) \
          template_id (FK) \
          slug
        ],
        name: <architectures>,
        width: 4.2cm,
        fill: core-col.lighten(55%),
      ),
      fletcher.node(
        (1, 2),
        align(left)[
          #align(center)[#text(weight: "medium")[architecture_files]] \
          #v(-30pt) \
          id (PK) \
          architecture_id (FK) \
          path
        ],
        name: <architecture-files>,
        width: 4.2cm,
        fill: core-col.lighten(60%),
      ),
      fletcher.node(
        (1, 3),
        align(left)[
          #align(center)[#text(weight: "medium")[provider_schemas]] \
          #v(-30pt) \
          id (PK) \
          provider \
          version
        ],
        name: <provider-schemas>,
        width: 4.2cm,
        fill: misc-col.lighten(65%),
      ),
      fletcher.node(
        (2, 0),
        align(left)[
          #align(center)[#text(weight: "medium")[architecture_imports]] \
          #v(-30pt) \
          id (PK) \
          architecture_id (FK) \
          provider
        ],
        name: <architecture-imports>,
        width: 4.2cm,
        fill: process-col.lighten(55%),
      ),
      fletcher.node(
        (2, 1),
        align(left)[
          #align(center)[#text(weight: "medium")[architecture_import_logs]] \
          #v(-30pt) \
          id (PK) \
          import_id (FK) \
          stream
        ],
        name: <architecture-import-logs>,
        width: 4.2cm,
        fill: process-col.lighten(60%),
      ),
      fletcher.node(
        (2, 2),
        align(left)[
          #align(center)[#text(weight: "medium")[architecture_applies]] \
          #v(-30pt) \
          id (PK) \
          architecture_id (FK) \
          provider
        ],
        name: <architecture-applies>,
        width: 4.2cm,
        fill: process-col.lighten(55%),
      ),
      fletcher.node(
        (2, 3),
        align(left)[
          #align(center)[#text(weight: "medium")[architecture_apply_logs]] \
          #v(-30pt) \
          id (PK) \
          apply_id (FK) \
          stream
        ],
        name: <architecture-apply-logs>,
        width: 4.2cm,
        fill: process-col.lighten(60%),
      ),
      fletcher.edge(<templates>, <template-params>, "->"),
      fletcher.edge(<templates>, <template-tags>, "->"),
      fletcher.edge(<templates>, <architectures>, "->"),
      fletcher.edge(<architectures>, <architecture-files>, "->"),
      fletcher.edge(<architectures>, <architecture-imports>, "->"),
      fletcher.edge(<architecture-imports>, <architecture-import-logs>, "->"),
      fletcher.edge(<architectures>, <architecture-applies>, "->"),
      fletcher.edge(<architecture-applies>, <architecture-apply-logs>, "->"),
    ),
    caption: [データベースのER図],
  ) <fig:db-er>
]

architecturesテーブルはプロジェクト名や説明，インポート元種別を保持し，architecture_filesテーブルはファイルパス単位でHCLを保持する．インポート処理はarchitecture_importsテーブルに状態を記録し，実行ログはarchitecture_import_logsテーブルに逐次追加されるため，処理の再現性と監査性が確保される．テンプレート機構はtemplatesテーブルとtemplate_parametersテーブルにより入力仕様を保持し，UIはこの定義に基づいて動的フォームを生成できる．

プロバイダスキーマはprovider_schemasテーブルにバージョン付きで保存されるため，ネットワークに依存せず再利用できる．これらのテーブルはユニークインデックスで整合性を保証し，architecture_filesテーブルではarchitecture_idとpathの組で重複を防止する．

== キャッシュ戦略と整合性
TerraGUIではHCLテキストをarchitecture_filesテーブルに保存し，graph_jsonを派生データとして扱う．グラフの再生成時にはHCLを再解析し，変更点のみを反映することで整合性を維持する．

== プロバイダスキーマの取得と更新
プロパティエディタが参照するスキーマは，Terraform CLIのproviders schema -jsonを用いて取得し，provider_schemasテーブルに保存する @terraform_providers_schema．スキーマはプロバイダ名とバージョンで一意に管理されるため，既に取得済みのバージョンは再取得を避けられる．このキャッシュ設計により，オフライン環境でも編集体験を維持できる．

== インポートログの保全とストリーミング
インポート処理の進捗はarchitecture_import_logsテーブルに逐次保存され，UI側ではストリーミングで取得する．標準出力と標準エラーを区別して保存することで，エラーメッセージの追跡や失敗原因の分析が容易になる．ログとステータスがDBに残るため，途中で画面を閉じても復帰可能である．

== 自動保存と競合
グラフの操作や属性編集は一定時間のデバウンス後に保存される．保存処理はトランザクションで包まれ，graph_jsonとarchitecture_filesテーブルの更新が同時に行われる．競合が発生しうるため，将来的には差分マージや履歴管理の拡張が必要である．

== 依存CLIの検出とセキュリティ
インポート機能では，AWS CLI，gcloud，Azure CLIとterracognitaの利用可否を事前に検出する．認証情報はインポート実行時にのみ利用し，DBには保存しない設計とすることで，情報漏洩リスクを最小化する．

CLI検出はPATH上の実行ファイル探索とバージョンコマンドの実行により行い，存在しても実行できない場合は候補から除外する．クラウド認証情報は入力直後にCLIで検証し，正当性が確認された場合のみインポートを開始する．この手順により，不正な認証情報や環境不備による失敗を早期に発見できる．

== 開発・配布と再現性
Dockerによるコンテナ化 @docker とDev Containers @devcontainers により，OS依存を排除した開発環境を提供する．VS Code拡張やNode.js環境を含めることで，開発者が同一の設定で利用できる．さらに，TypeScriptの厳格な型チェック @typescript とBiome @biome，Lefthook @lefthook，commitlint @commitlint を組み合わせ，品質と保守性を確保する．

開発・配布のワークフローは @fig:workflow-dev-release に示す．
#[#set text(size: 9pt)
  #let flow-col = palette.indigo
  #let data-col = palette.green
  #let ext-col = palette.orange
  #figure(
    fletcher.diagram(
      node-stroke: 1pt,
      edge-stroke: 0.7pt,
      node-corner-radius: 2pt,
      node-inset: 6pt,
      spacing: (1.4em, 1.2em),
      fletcher.node(
        (0, 0),
        align(center)[
          #set text(weight: "medium")
          開発環境 \
          #v(-18pt) \
          Node.js / pnpm
        ],
        name: <dev-env>,
        width: 3.6cm,
        fill: flow-col.lighten(50%),
      ),
      fletcher.node(
        (0, 1),
        align(center)[
          #set text(weight: "medium")
          Docker / Dev Container \
          #v(-18pt) \
          環境固定
        ],
        name: <container>,
        width: 4.2cm,
        fill: flow-col.lighten(50%),
      ),
      fletcher.node(
        (0, 2),
        align(center)[
          #set text(weight: "medium")
          静的解析・フォーマット \
          #v(-18pt) \
          Biome / Lefthook
        ],
        name: <lint>,
        width: 4.4cm,
        fill: flow-col.lighten(50%),
      ),
      fletcher.node(
        (0, 3),
        align(center)[
          #set text(weight: "medium")
          ビルド・起動 \
          #v(-18pt) \
          Next.js
        ],
        name: <build>,
        width: 3.8cm,
        fill: flow-col.lighten(50%),
      ),
      fletcher.node(
        (1, 2),
        align(center)[
          #set text(weight: "medium")
          データ初期化 \
          #v(-18pt) \
          seeds / scripts
        ],
        name: <seed>,
        width: 3.8cm,
        fill: data-col.lighten(50%),
      ),
      fletcher.node(
        (1, 3),
        align(center)[
          #set text(weight: "medium")
          配布物 \
          #v(-18pt) \
          terragui.db含む
        ],
        name: <artifact>,
        width: 3.8cm,
        fill: ext-col.lighten(55%),
      ),
      fletcher.edge(<dev-env>, <container>, "->"),
      fletcher.edge(<container>, <lint>, "->"),
      fletcher.edge(<lint>, <build>, "->"),
      fletcher.edge(<lint>, <seed>, "->"),
      fletcher.edge(<build>, <artifact>, "->"),
      fletcher.edge(<seed>, <artifact>, "->"),
    ),
    caption: [開発・配布のワークフロー],
  ) <fig:workflow-dev-release>
]

TerraGUIはローカル環境で完結するため，追加のSaaS契約やクラウド依存を必要としない．SQLiteを利用することでデータベースの配布が容易になり，terragui.dbを含めた状態をそのまま配布・バックアップできる．Dev ContainerによりUbuntu環境が統一されるため，研究室やチーム内での再現性が高い．

= 評価

== 機能比較
提案システムと，既存の代表的なTerraform可視化・編集ツールとの機能比較を表 @fig:tool-compare に示す．

#figure(
  table(
    columns: (auto, 1.5fr, 1.5fr, 1fr, 1fr),
    table.header([*機能*], [*TerraGUI (提案)*], [*Brainboard*], [*Inframap*], [*Blast Radius*]),
    [可視化方式], [CSTベース （詳細）], [独自モデル], [State/HCL], [State],
    [編集機能], [〇 （双方向・ロスレス）], [〇 （独自形式）], [×], [×],
    [コメント保持], [〇], [× （再生成時に消失）], [N/A], [N/A],
    [既存コード利用], [〇 （直接編集）], [△ （インポート必須）], [〇], [〇],
    [UI階層化], [〇 （自動・意味的）], [〇 （手動）], [×], [×],
    [導入コスト], [低 (OSS/Local)], [高 (SaaS)], [低], [低],
  ),
  caption: [既存ツールとの機能比較],
) <fig:tool-compare>

== データセットと評価軸
評価対象としては，公開リポジトリのTerraformコードに加え，TerraDSのような研究用データセットを利用する予定である @BuhlerSMS25．コード規模やリソース種類，モジュール構成の多様性を確保し，ロスレス性・グラフ生成精度・編集操作の安定性を測定する．また，TerraMetricsで提案されているメトリクスや，品質評価フレームワークの指標を参照し，客観的な評価軸を整理する @BegougC024 @abs2502_03127．

== ロスレス性の検証
実装したHCL Engineの堅牢性を検証するため，GitHub上の公開Terraformリポジトリから無作為に抽出した.tfファイルを用いてテストする計画である．各ファイルに対しパースから文字列化へのラウンドトリップを実施し，元のテキストと一致するかを確認する．また，プロパティの一部を変更して再生成した場合でも，変更箇所以外が維持されることを検証する．

評価では，差分行数と差分比率を指標として記録し，変更操作によって不要な差分が生じていないことを定量的に示す．さらに，HCLをJSONに変換する一般的なツールと比較し，コメントや空行が保持されないケースとの差を明確化する @hcl2json．

== パフォーマンス評価
大規模なグラフを表示した際の描画パフォーマンスを計測する．elkjsによるレイアウト計算はWeb Worker等で非同期化していない現状では，数百ノード規模で数百ミリ秒程度の計算時間を要するが，UIのフリーズは許容範囲内である．React Flowのレンダリングは仮想化が効いており，スクロールやズームは滑らかに動作することを確認した．

追加で，HCL解析時間，グラフ生成時間，レイアウト時間を分離して測定する計画である．特にレイアウトはノード数とエッジ数に敏感であるため，入力規模に応じたスケーリング特性を評価し，必要に応じて非同期化や差分レイアウトの導入を検討する．

== テスト戦略と指標
今後，Vitest @vitest による単体テストとカバレッジ計測を導入し，HCL EngineとGraph Engineの主要関数を網羅的に検証する予定である．加えて，実際の操作を模擬したシナリオテストや，インポート処理の安定性検証を通じて機能品質を評価する．静的解析についてはTypeScriptとBiomeを用いて厳格な型安全性と規約準拠を担保する．

評価指標としては，パース成功率，ロスレス率（完全一致率），グラフ生成成功率，及びテストカバレッジを設定する．特にHCL Engineは入力の多様性が高いため，テストケースをTerraDSなどの実データに近い分布で生成し，実運用に近い条件での安定性を確認する @BuhlerSMS25．

= 考察

== 意味的階層化の効果と限界
意味的階層化はユーザのメンタルモデルに近い可視化を提供する一方，リソース属性の推論に依存するため，複雑な式やモジュール構成では意図通りの階層化を実現できない場合もある．特に複数のVPCやリージョンを跨る構成では推論の精度が低下しうるため，今後は明示的なグルーピング指定や手動調整機構が必要となる．

また，Terraformモジュールは内部で複数リソースを生成するため，モジュール境界を超えて依存が張られる場合に階層化が曖昧になる．for_eachやcountによる動的生成は，参照先の実体が評価時に決定するため，静的解析での完全な復元は難しい．これらの制約は，HCLの表現力が高いことによる必然的なトレードオフといえる．

== スケーラビリティと運用負荷
大規模構成に対するレイアウト計算はELKに依存するため，ノード数増大に伴い計算コストが増加する．非同期レイアウトや差分レイアウトを導入することで改善可能だが，実装コストとのトレードオフが存在する．

さらに，プロバイダスキーマのサイズやアイコンマッピングの規模も増大するため，キャッシュの整理と更新頻度の最適化が重要となる．特にプロバイダの新サービス追加に追従する際には，アイコンセット更新の自動化が必要となる．

== 妥当性の脅威
本研究はユーザ評価を実施していないため，操作性や学習効果に関する外的妥当性は限定的である．今後はユーザ実験を通じて，認知負荷や作業効率の改善を定量的に検証する必要がある．

また，評価対象のHCLコードは公開リポジトリに偏る可能性があり，企業内の大規模構成や機密構成を十分に代表できない．複数プロバイダや複雑なモジュール構成に対する一般化可能性についても，今後の検証が求められる．

= 結論

本研究では，Infrastructure as Codeの課題である視認性の低さと学習コストの高さを解決するために，Webベースの視覚的編集環境「TerraGUI」を開発した．提案システムは，以下の3つの特徴を持つ．

第一に，ロスレスな具象構文木変換である．typescript-parsecを用いたパーサにより，HCLコードのコメントやフォーマットを維持したまま，GUIによる直感的な編集を実現した．第二に，意味的階層化である．elkjsとリソース属性解析を組み合わせ，VPCやSubnetの包含関係を反映した見やすいグラフを自動生成した．第三に，既存ワークフローとの統合である．HCLテキストを.tf互換のまま保持し，既存のGitワークフローと矛盾しない形で編集できるようにした．

これらの機能により，開発者の認知負荷を低減し，Infrastructure as Codeの保守性と生産性を向上させることが可能となった．

また，テンプレート機構やインポート機構を通じて，既存環境と新規構成の双方に対応できることを示した．HCLのロスレス編集と視覚的編集の融合は，Infrastructure as Codeの導入障壁を下げ，設計と実装の往復を容易にする基盤になると考える．

今後の課題として，複数人による同時編集機能の実装や，AIエージェントやLLMを用いた自然言語からの構成提案機能の統合が挙げられる．これらの方向性は，LLMを活用したInfrastructure as Code支援研究の動向とも整合しており，将来的な拡張の基盤となる @VoDF25 @TopraniM25 @abs2510_03902．

#page[
  #heading(numbering: none)[謝辞]
  本研究を進めるにあたり，熱心なご指導とご鞭撻を賜りました指導教員の井口教授に深く感謝いたします．
  また，日々の議論を通じて有益な助言をいただいた研究室の皆様，ならびに本ソフトウェアの評価に協力していただいた方々に心より感謝申し上げます．
]

#bibliography("works.bib", style: "./cite.csl")
