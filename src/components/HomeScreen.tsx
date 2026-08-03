interface HomeScreenProps {
  onStart: () => void;
}

const title = "\u628a\u52a8\u4f5c\u8df3\u5f00";
const copy = "\u8ddf\u7740\u97f3\u4e50\uff0c\u628a\u6bcf\u4e00\u4e2a\u52a8\u4f5c\u505a\u5230\u66f4\u8212\u5c55\u3002";
const startLabel = "\u5f00\u59cb\u6e38\u620f";
const backgroundLabel = "\u821e\u8e48\u793a\u8303\u80cc\u666f";
const privacyNote = "\u89c6\u9891\u548c\u6444\u50cf\u5934\u6570\u636e\u4ec5\u5728\u672c\u5730\u5904\u7406";

export function HomeScreen({ onStart }: HomeScreenProps) {
  return (
    <main className="prototype-stage prototype-stage--home">
      <video className="stage-media" aria-label={backgroundLabel} autoPlay loop muted playsInline preload="metadata" src="/levels/level-1.mp4" />
      <div className="stage-scrim" aria-hidden="true" />
      <header className="stage-header"><span className="stage-brand">FullyDancy</span><span className="stage-mode">Dance practice</span></header>
      <section className="home-intro" aria-labelledby="home-title"><p className="stage-kicker">Move with intention</p><h1 id="home-title">{title}</h1><p>{copy}</p></section>
      <footer className="stage-footer"><p className="stage-note">{privacyNote}</p><button className="primary-action" type="button" onClick={onStart}>{startLabel}</button><span className="stage-balance" aria-hidden="true" /></footer>
    </main>
  );
}
