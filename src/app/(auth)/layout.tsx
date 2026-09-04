import { SiteHeader } from '@/components/site-header';

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-14">
        {children}
      </main>
    </>
  );
}
