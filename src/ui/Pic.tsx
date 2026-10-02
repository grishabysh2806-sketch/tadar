import { PICS } from './pics';

/** Рисованная картинка по эмодзи; если рисунка нет — сам эмодзи. */
export function Pic({ e, size = 40, className }: { e: string; size?: number; className?: string }) {
  const svg = PICS[e];
  if (!svg)
    return (
      <span className={className} style={{ fontSize: Math.round(size * 0.82), lineHeight: 1 }} aria-hidden>
        {e}
      </span>
    );
  return <svg className={className} width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: svg }} />;
}
