import { ParticleDancerHero } from "./ParticleDancerHero";
import { SkipAction } from "./SkipAction";

interface HomeScreenProps {
  onStart: () => void;
  onSkip: () => void;
}

const productName = "FullyDancy";
const productIntro = "AI 居家练舞助手，帮你看见身体舒展、手臂打开和每一次卡点。";
const startLabel = "开始游戏";
const privacyNote = "视频和摄像头数据仅在本地处理";

export function HomeScreen({ onStart, onSkip }: HomeScreenProps) {
  return (
    <main className="prototype-stage prototype-stage--home">
      <ParticleDancerHero />
      <div className="stage-scrim" aria-hidden="true" />
      <header className="stage-header">
        <span className="stage-brand">Dance practice</span>
        <span className="stage-mode">AI dance coach</span>
      </header>
      <section className="home-intro" aria-labelledby="home-title">
        <p className="stage-kicker">Pose tracking · rhythm hit · body calibration</p>
        <h1 id="home-title" className="home-product-name">
          {productName}
        </h1>
        <p className="home-product-intro">{productIntro}</p>
      </section>
      <footer className="stage-footer">
        <p className="stage-note">{privacyNote}</p>
        <button className="primary-action" type="button" onClick={onStart}>
          {startLabel}
        </button>
        <span className="stage-balance" aria-hidden="true" />
      </footer>
      <SkipAction onSkip={onSkip} />
    </main>
  );
}
