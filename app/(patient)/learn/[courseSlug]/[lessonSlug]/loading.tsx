export default function Loading() {
  return (
    <div className="p-5 sm:p-6 max-w-4xl">
      <div className="skeleton h-4 w-64 rounded-lg mb-6" />
      <div className="skeleton h-8 w-80 rounded-lg mb-6" />
      <div className="skeleton rounded-2xl mb-6" style={{ aspectRatio: "16/9" }} />
      <div className="skeleton h-10 w-full rounded-xl" />
    </div>
  );
}
