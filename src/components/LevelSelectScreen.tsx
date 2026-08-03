import type { BuiltInLevel } from "../levels/builtInLevel";

interface LevelSelectScreenProps {
  level: BuiltInLevel;
  onSelect: () => void;
  onBack: () => void;
}

const selectTitle = "\u9009\u62e9\u4f60\u7684\u6311\u6218";
const backLabel = "\u8fd4\u56de";
const levelCopy = "\u4ece\u5185\u7f6e\u821e\u8e48\u5f00\u59cb\uff0c\u611f\u53d7\u97f3\u4e50\u7684\u8282\u594f\u4e0e\u8eab\u4f53\u7684\u5ef6\u5c55\u3002";
const builtInMeta = "\u5185\u7f6e\u7ec3\u4e60\u00b7 45 \u79d2";
const uploadLabel = "\u4e0a\u4f20\u81ea\u5df1\u7684\u821e\u8e48\uff08\u5373\u5c06\u5f00\u653e\uff09";
const footerNote = "\u5148\u8fd9\u4e48\u8df3\u4e00\u6b21\uff0c\u518d\u4e00\u6b21\u3002";

export function LevelSelectScreen({ level, onSelect, onBack }: LevelSelectScreenProps) {
  const selectionLabel = `\u9009\u62e9 ${level.title}`;

  return (
    <main className="prototype-stage prototype-stage--selection">
      <header className="stage-header"><button className="back-action" type="button" aria-label={backLabel} onClick={onBack}>{backLabel}</button><span className="stage-brand">FullyDancy</span><span className="stage-mode">01 / 01</span></header>
      <section className="level-select" aria-labelledby="level-select-title">
        <p className="stage-kicker">Choose your track</p><h1 id="level-select-title">{selectTitle}</h1><p className="level-select__copy">{levelCopy}</p>
        <div className="level-choices">
          <button className="level-choice level-choice--active" type="button" aria-label={selectionLabel} onClick={onSelect}><span className="level-choice__index">01</span><span className="level-choice__body"><strong>{level.title}</strong><span>{builtInMeta}</span></span><span className="level-choice__select">{selectionLabel}</span></button>
          <button className="level-choice level-choice--disabled" type="button" aria-label={uploadLabel} disabled><span className="level-choice__index">02</span><span className="level-choice__body"><strong>{uploadLabel}</strong><span>Coming soon</span></span></button>
        </div>
      </section>
      <footer className="stage-footer stage-footer--selection"><p className="stage-note">{footerNote}</p></footer>
    </main>
  );
}
