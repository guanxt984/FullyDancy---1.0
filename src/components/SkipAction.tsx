export function SkipAction({ onSkip }: { onSkip(): void }) {
  return <button className="skip-action" type="button" onClick={onSkip}>跳过</button>;
}
