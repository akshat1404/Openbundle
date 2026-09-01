/**
 * Ordering's real output is a sequence, not a graph — so its panel is a
 * deliberately different shape from the resolve stage's diagram: a
 * single vertical chain of files with a plain arrow between consecutive
 * entries, not a branching layout.
 */
export function OrderSequence({ order, entry }: { order: string[]; entry: string }) {
  return (
    <ol className="order-sequence">
      {order.map((path, i) => (
        <li key={path} className="order-sequence__item">
          <div className="order-sequence__box">
            <span className="order-sequence__index">{i + 1}</span>
            <span className="order-sequence__path">{path}</span>
            {path === entry && <span className="order-sequence__entry-tag">entry</span>}
          </div>
          {i < order.length - 1 && (
            <span className="order-sequence__arrow" aria-hidden="true">
              ↓
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
