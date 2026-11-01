# Holo Pod

ビルド不要の静的SPAスマートディスプレイです。Alpine.jsとPinecone RouterをCDNから読み込み、ハッシュルーティングでテーマ別ダッシュボード、タイムゾーン設定、つくよみちゃんVRMビューワーを切り替えて表示します。

## 機能

- シンプル、8-bitゲーム、RPG、ターミナルの4種類の天気ダッシュボード
- 現在時刻、日付、曜日、天気、気温、湿度、降水情報の表示
- IANAタイムゾーン設定とブラウザー内への保存
- ≡キー／画面メニュー、上下矢印キーによるページ移動
- つくよみちゃんVRMと7種類のVRMAモーションのランダム再生
- モバイルからデスクトップまでのレスポンシブレイアウト
- GitHub Pagesで公開できる静的ファイル構成

## ページ

| URL | ページ | テーマ |
| --- | --- | --- |
| `#/simple` | シンプルダッシュボード | UnoCSS Runtime |
| `#/game` | ゲーム風ダッシュボード | NES.css Core |
| `#/rpg` | RPG風ダッシュボード | RPGUI |
| `#/terminal` | ターミナル風ダッシュボード | Terminal.css |
| `#/tsukuyomi` | つくよみちゃんVRMビューワー | Three.js / `@pixiv/three-vrm` |
| `#/settings` | 設定 | 共通スタイル |

## ローカルでの起動

`fetch()`で各ページを読み込み、ES ModulesでVRMを表示するため、`index.html`を`file://`で直接開かず、HTTPサーバー経由でアクセスしてください。VS CodeのLive Serverなど、静的ファイルを配信するサーバーを利用できます。

起動後、サーバーが表示するURLをブラウザーで開きます。トップページからメニューまたはキー操作で各ページへ移動できます。

## 操作

- `/`キー: メニューを開く。メニュー表示中にもう一度押すと選択中のページへ移動
- メニュー表示中の`ArrowUp` / `ArrowDown`: 選択項目を移動
- メニュー表示中の`Escape`: メニューを閉じる
- メニューを閉じた状態の`ArrowUp` / `ArrowDown`: 前後のページへ直接移動
- 画面上の≡ボタンやメニュー項目: タッチ／マウスで操作

## 設定

設定ページでタイムゾーンを選べます。選択したIANAタイムゾーンは`localStorage`に保存され、ダッシュボードの時計・日付と天気APIのタイムゾーンに反映されます。天気の観測地点は東京を初期値としています。

## GitHub Pagesへのデプロイ

リポジトリには`.github/workflows/pages.yml`のGitHub Actionsワークフローがあります。

1. GitHubのリポジトリ設定でPagesの公開元を **GitHub Actions** にします。
2. `main`ブランチへ変更をpushするか、Actionsタブから手動実行します。
3. ワークフローが静的ファイルをステージングし、GitHub Pagesへデプロイします。

このワークフローはVRMモデルと7種類のVRMAを公開成果物に含めます。デプロイ前に、それぞれの配布条件を確認してください。アセットの出典・規約資料は次を参照してください。

- VRM: [つくよみちゃん公式3Dモデル タイプA 配布ページ](https://tyc.rei-yumesaki.net/material/avatar/3d-a/)
- VRMクレジット: **つくよみちゃん公式3Dモデル タイプA — 夢前黎**
- VRMAクレジット: **キャラクターアニメーション: ピクシブ株式会社 VRoidプロジェクト**

GitHub PagesのURLがリポジトリのサブパスに置かれる場合も、アプリのページ・スクリプト・モデルは相対パスで読み込みます。

## 使用技術

- Vanilla JavaScript（ES Modules）
- Alpine.js 3、Pinecone Router 4
- UnoCSS Runtime、NES.css Core、RPGUI、Terminal.css
- Three.js、`@pixiv/three-vrm`、`@pixiv/three-vrm-animation`
- Open-Meteo API

ライブラリはバージョンを固定したCDNから読み込みます。ビルドツール、バンドラー、パッケージインストールは不要です。

## ライセンス

このプロジェクトのソースコードは [MIT License](LICENSE) のもとで公開します。

つくよみちゃんVRM、VRMAモーション、CDNで読み込むライブラリ、フォントその他の第三者素材は、このリポジトリのMIT Licenseには含まれません。それぞれの配布元ライセンス・利用規約が適用されます。VRM/VRMAのクレジットと禁止用途は上記のとおりです。VRMAについては配布元規約に基づき、特に商用利用時の所定クレジット表示と禁止用途を遵守してください。
