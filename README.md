# マストドンアクション解析bot

## なにこれ？

分散SNSサービス「マストドン」のトゥートを分析するために必要なデータを集めるためのものです。  
自分専用で書いたので誰も使わないとは思いますが一応説明だけ  

It is for gathering data necessary for analyzing the tout of the distributed SNS service "Mastodon".  
As I wrote it for myself, I do not think anyone would use it, but only for the sake of explanation.

適当に翻訳サイトに突っ込んだだけだけど英語これで合ってるかしらん。

## 使い方

node.js 9.x系で開発してるのでそこらへんのを用意してください。  
そしたら `npm install`

`./config/default.json.sample` を `./config/default.json` にコピーして中身をいい感じに直す

`npm start` … ツール動くよ！ `db.sqlite3` に取得したデータを吐き出すよ！  
止めない限り延々とFTLを遡り続けるけど、ツールのエラーかAPI制限に引っかかって止まるから気にしなくていいよ！

`npm run speed` … 流速計の情報を取得して `db.sqlite3` に追記するよ！

流速計の情報を取り込んだらいい感じに適当にsqlite3クライアント探してきてデータ拾ってみてね！


