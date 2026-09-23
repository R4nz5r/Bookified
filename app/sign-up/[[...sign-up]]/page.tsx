import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="sign-in-page-container">
      <div className="sign-in-card-wrapper">
        <SignUp />
      </div>
    </main>
  );
}
