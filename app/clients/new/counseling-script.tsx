// 初回カウンセリング トークスクリプト。編集不可の静的な参照コンテンツ(MitateCheatsheetと同じ位置づけ)。
// 新規顧客登録時の問診面談で、スタッフが何を聞き、どこに記録するかをまとめたカンペ。

const OPENING_LINES = [
  "本日はご来院いただきありがとうございます。",
  "〇〇さんですね。今日担当させて頂きます〇〇です。本日はよろしくお願い致します。",
  "〇〇さんのお身体が健康になるためにお話から聞いていきます。お身体をよくしていくためには今のお身体の不調がどこからきているのか見ていき、必要な通い方などを提案させていただきますが、合う合わないがあると思いますので、受けながら考えてもらえたらと思います。",
];

const ICEBREAK_LINES = [
  "今からお話を聞かせて頂くのですが、緊張されていませんか?",
  "道には迷いませんでしたか?",
  "〇〇さんのお身体が良くなるようにしっかりサポートさせていただきますので、よろしくお願い致します。",
  "最後〇〇さんが笑顔で帰って頂けるように全力で治療しますのでよろしくお願い致します!",
];

const DISCOVERY_STEPS: { q: string; hint?: string; recordTo: string }[] = [
  {
    q: "ここに来たきっかけやお身体のお悩みは何ですか?(当院を知ったきっかけ)",
    hint: "HPの場合:「どうやってHPにたどり着きましたか?どんなワードで検索されましたか?」/ 紹介の場合:「どんなふうに聞いていますか?」",
    recordTo: "「来店きっかけ」欄(すでに下にあります)",
  },
  {
    q: "こちらへはどのような期待をもっていらっしゃいましたか?(他にも治療院がある中で、当院を選んだポイント・決め手)",
    recordTo: "「個人データ」欄",
  },
  {
    q: "今一番気になる場所は?症状は?どんな時に?特に何をした後に?(擬音で表現すると?ジンジン、ビキッ、ズーンなど)",
    hint: "例: デスクワーク後→座り方、起きたとき→ストレス・血行不良・筋肉",
    recordTo: "主訴タグ(来院記録)+「個人データ」欄に擬音・誘因の詳細",
  },
  {
    q: "今、日常生活で一番困っていることはなんですか?",
    recordTo: "「顕在ニーズ」欄(すでに下にあります)",
  },
  {
    q: "どのような状態になったらうれしいですか?",
    hint: "過去→現在→未来の時間軸を意識する。短期的な問題だけでなく、長期的な問題(歩けなくなる・介護・重篤な病気)の両方を抱えていることを意識させる",
    recordTo: "「ウォンツ」欄(すでに下にあります)",
  },
  {
    q: "今まで治療院は行かれたことはありますか?",
    recordTo: "「個人データ」欄(事前問診票でも収集済みの場合あり)",
  },
];

const SUMMARY_TEMPLATE =
  "〇〇さんの今一番解決したいお悩みは〇〇で、今ほかに〇〇の症状もあり、〇〇前から悩んでいて、原因として〇〇の可能性があるということですね。また、〇〇をしたら良くなりそうということですね。";

const SESSION_FLOW: { title: string; note: string }[] = [
  { title: "検査(10分程度)", note: "痛みを指標にしない。検査チェック項目をもとに、お客様へ軽く伝えながら行う。インナーの弱さチェックは必須" },
  { title: "紙芝居・身体の見立て説明(10分)", note: "検査結果を含めて説明する。「ここまで何か分かりにくいところ、質問などありますか?」で施術へ。本日はより細かい原因を見つけるため、検査をしながらの施術になる旨を伝える" },
  { title: "施術中トーク", note: "「普段健康になるために取り組んでいることはありますか?」とにかく承認(一施術、一承認)。「今日からご自分で5分で取り組めるものは考えられますか?」" },
  { title: "施術中クロージング", note: "提案ではなく未来を描かせる時間。来院頻度を明確に伝える。ある程度、曜日も決めていく" },
  { title: "施術後(ベッドサイドで実施)", note: "「施術はしんどくなかったですか、大丈夫でしたか?」「施術を受けられてお体の状態で気になったことや気づいたことはありますか?」(良くするための共通認識を揃える)" },
];

export function CounselingScript() {
  return (
    <details className="rounded-md border border-stone-200 bg-stone-50 p-3">
      <summary className="cursor-pointer text-sm font-medium text-stone-700">初回カウンセリング トークスクリプトを開く</summary>

      <div className="mt-3 flex flex-col gap-5 text-xs text-stone-700">
        <section>
          <h3 className="mb-1 font-semibold text-stone-800">オープン・関係づくり(必須トーク)</h3>
          <ul className="list-disc pl-4 space-y-1">
            {OPENING_LINES.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-1 font-semibold text-stone-800">導入(アイスブレイク)</h3>
          <ul className="list-disc pl-4 space-y-1">
            {ICEBREAK_LINES.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-1 font-semibold text-stone-800">ヒアリング項目(どこに記録するか)</h3>
          <ol className="list-decimal pl-4 space-y-2">
            {DISCOVERY_STEPS.map((s, i) => (
              <li key={i}>
                <p>{s.q}</p>
                {s.hint && <p className="text-stone-500">{s.hint}</p>}
                <p className="text-emerald-800">→ {s.recordTo}</p>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h3 className="mb-1 font-semibold text-stone-800">要約トーク例</h3>
          <p>{SUMMARY_TEMPLATE}</p>
        </section>

        <section>
          <h3 className="mb-1 font-semibold text-stone-800">このあとの流れ</h3>
          <ul className="list-disc pl-4 space-y-1">
            {SESSION_FLOW.map((s, i) => (
              <li key={i}>
                <span className="font-medium text-stone-800">{s.title}</span>: {s.note}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </details>
  );
}
