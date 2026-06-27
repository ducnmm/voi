"use client";

import { useAuth } from "@/lib/auth";
import { RequireAuth } from "@/components/require-auth";
import { Label, PillLink } from "@/components/bento";
import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";

function ProfileInner() {
  const { user } = useAuth();
  if (!user) return null;
  const initial = (user.displayName || user.email || "?").charAt(0).toUpperCase();

  return (
    <main className="w-full p-3 sm:p-4 lg:h-[100dvh]">
      <BentoGrid className="lg:h-full lg:auto-rows-[minmax(0,1fr)]">
        {/* identity — hero */}
        <BentoCard tone="sage" className="lg:col-span-2 lg:row-span-2">
          <Label>Hồ sơ</Label>
          <div className="mt-auto flex items-center gap-5">
            <span className="grid h-20 w-20 place-items-center rounded-full bg-forest text-3xl font-black text-forest-fg">
              {initial}
            </span>
            <div>
              <p className="text-3xl font-black uppercase tracking-tight sm:text-4xl">
                {user.displayName}
              </p>
              <p className="mt-1 text-sm font-bold opacity-70">{user.email}</p>
            </div>
          </div>
        </BentoCard>

        <BentoCard tone="sand">
          <p className="mt-auto text-5xl font-black">0</p>
          <p className="mt-2 text-xs font-bold uppercase tracking-wide opacity-70">
            Lượt đặt sân
          </p>
        </BentoCard>

        <BentoCard tone="mint">
          <Label>Trình độ</Label>
          <p className="mt-auto text-2xl font-black uppercase">
            {user.defaultSkillLevel}
          </p>
        </BentoCard>

        <BentoCard tone="paper" className="lg:col-span-3">
          <div className="flex h-full flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <Label>Quản lý</Label>
              <p className="mt-1 text-lg font-bold">Cập nhật thông tin & sân của bạn</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <PillLink href="/host" tone="forest">
                Sân của tôi
              </PillLink>
              <PillLink href="/" tone="sage">
                ← Trang chủ
              </PillLink>
            </div>
          </div>
        </BentoCard>
      </BentoGrid>
    </main>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileInner />
    </RequireAuth>
  );
}
