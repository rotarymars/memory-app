import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth";
import { SignInForm } from "./SignInForm";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getUserId()) redirect("/");
  const { next } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Sign in</h1>
        <SignInForm next={next ?? "/"} />
      </div>
    </div>
  );
}
