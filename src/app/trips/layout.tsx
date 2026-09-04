import { SiteHeader } from '@/components/site-header';

export default function TripsLayout({ children }: LayoutProps<'/trips'>) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
        {children}
      </main>
    </>
  );
}
