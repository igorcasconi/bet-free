import { getCurrentFirebaseUid } from "@/lib/auth/get-current-user";
import { getMatchesPageData, MatchesPageContent } from "@/features/matches";

export default async function MatchesPage() {
  const firebaseUid = await getCurrentFirebaseUid();
  const { todayGroups, upcomingPage } = await getMatchesPageData(firebaseUid);

  return (
    <div className="flex flex-col gap-6 p-6">
      <MatchesPageContent
        todayGroups={todayGroups}
        upcomingPage={upcomingPage}
      />
    </div>
  );
}
