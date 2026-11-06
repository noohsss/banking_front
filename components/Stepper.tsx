export function Stepper({ total, current }: { total: number; current: number }) {
  return (
    <div className="ian-stepper" aria-label={`${total}단계 중 ${current + 1}단계`}>
      {Array.from({ length: total }, (_, i) => <i key={i} className="ian-stepper__seg" data-state={i < current ? "done" : i === current ? "current" : undefined} />)}
    </div>
  );
}
