'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { Team, TeamMember } from '@/lib/db';

interface Props {
  children: React.ReactNode;
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  teams?: (TeamMember & { team: Team })[];
  overallScore?: number | null;
  activePage?: 'dashboard' | 'settings' | 'repo';
}

export default function PlatformShell({
  children,
  user,
  teams = [],
  overallScore,
  activePage = 'dashboard',
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentTeamId, setCurrentTeamId] = useState<string | 'personal'>(
    'personal'
  );

  const handleSwitchTeam = (teamId: string | 'personal') => {
    setCurrentTeamId(teamId);
    // If we're not on dashboard, we might want to redirect to dashboard when switching teams
    // to refresh the repository list for that context.
    if (pathname !== '/dashboard') {
      router.push('/dashboard');
    }
  };

  return (
    <div
      className={`min-h-screen bg-[#0a0a0f] ${user ? 'flex overflow-hidden' : ''}`}
    >
      {user && <Sidebar overallScore={overallScore} />}

      <div className={`flex-1 flex flex-col min-w-0 ${user ? 'h-screen' : ''}`}>
        {user && (
          <Navbar
            user={user}
            teams={teams}
            currentTeamId={currentTeamId}
            onSwitchTeam={handleSwitchTeam}
            activePage={activePage}
          />
        )}

        <main
          className={`relative flex-1 ${user ? 'overflow-y-auto' : ''} z-10`}
        >
          {user && (
            <>
              <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
                <div className="orb orb-blue w-96 h-96 -top-48 -right-48 opacity-20" />
                <div className="orb orb-purple w-80 h-80 bottom-0 -left-40 opacity-20" />
              </div>
              <div className="absolute inset-0 bg-grid-pattern opacity-10 -z-10" />
            </>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
