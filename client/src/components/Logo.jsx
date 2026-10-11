export default function Logo({ className = '', size = 'md' }) {
  const big = size === 'lg';
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span
        className={`grid place-items-center rounded-xl bg-accent font-serif font-semibold text-on-accent ${big ? 'h-12 w-12 text-3xl' : 'h-9 w-9 text-2xl'}`}
        aria-hidden
      >
        F
      </span>
      <span className={`font-serif font-medium tracking-tight ${big ? 'text-4xl' : 'text-2xl'}`}>Finenzo</span>
    </div>
  );
}
