import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="sign-in-page-container">
      <div className="sign-in-card-wrapper">
        <SignIn />
      </div>
    </main>
  );
}
