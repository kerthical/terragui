#!/bin/bash

npm install
npm run db:reset
npm run db:migrate
npm run db:seed
