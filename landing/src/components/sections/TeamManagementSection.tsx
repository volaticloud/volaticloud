import Container from '../ui/Container'

const members = [
  { name: 'Alice', role: 'Admin', roleColor: 'bg-[#079211]/20 text-[#079211]', strategies: 'Full', bots: 'Full' },
  { name: 'Bob', role: 'Trader', roleColor: 'bg-blue-500/20 text-blue-400', strategies: 'Edit', bots: 'Edit' },
  { name: 'Carol', role: 'Viewer', roleColor: 'bg-white/10 text-white/50', strategies: 'View', bots: 'View' },
]

const avatarColors = ['bg-[#FF541F]', 'bg-[#079211]', 'bg-blue-500', 'bg-purple-500']

function MockTeamDashboard() {
  return (
    <div className="w-full max-w-[560px] rounded-2xl border border-white/10 bg-[#1b1b1c] p-5 shadow-2xl">
      {/* Org header */}
      <div className="flex items-center gap-3 border-b border-white/10 pb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF541F]/20 text-sm font-bold text-[#FF541F]">
          A
        </div>
        <div>
          <div className="text-sm font-bold text-white">Acme Trading</div>
          <div className="text-[11px] text-white/40">3 members · Pro Plan</div>
        </div>
        <div className="ml-auto flex -space-x-2">
          {avatarColors.slice(0, 3).map((color, i) => (
            <div
              key={i}
              className={`h-7 w-7 rounded-full border-2 border-[#1b1b1c] ${color}`}
            />
          ))}
        </div>
      </div>

      {/* Permissions table */}
      <div className="mt-4">
        <div className="grid grid-cols-4 gap-2 text-[10px] text-white/30 uppercase tracking-wider pb-2 border-b border-white/5">
          <span>User</span>
          <span>Role</span>
          <span>Strategies</span>
          <span>Bots</span>
        </div>
        {members.map((m) => (
          <div key={m.name} className="grid grid-cols-4 gap-2 items-center py-2.5 border-b border-white/5 last:border-0">
            <span className="text-sm text-white/80">{m.name}</span>
            <span className={`inline-flex w-fit rounded-md px-2 py-0.5 text-[10px] font-bold ${m.roleColor}`}>
              {m.role}
            </span>
            <span className="text-xs text-white/50">{m.strategies}</span>
            <span className="text-xs text-white/50">{m.bots}</span>
          </div>
        ))}
      </div>

      {/* Invite bar */}
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-dashed border-white/10 p-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 text-white/30 text-sm">
          +
        </div>
        <span className="text-xs text-white/30">Invite team member...</span>
      </div>
    </div>
  )
}

export default function TeamManagementSection() {
  return (
    <section className="py-24" id="team-management">
      <Container>
        <div className="flex flex-col lg:flex-row-reverse items-center gap-16">
          {/* Text right */}
          <div className="flex-1">
            <h2 className="text-[48px] font-bold leading-tight text-white">
              Enterprise-Ready{' '}
              <span className="text-[#FF541F]">Team Management</span>
            </h2>
            <ul className="mt-8 space-y-4 text-lg text-white/70">
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#FF541F]" />
                Multi-tenant organizations with user invitations
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#FF541F]" />
                Role-based access control (admin, trader, viewer)
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#FF541F]" />
                Shared strategies, bots, and exchange connections
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#FF541F]" />
                Fine-grained permission scopes per resource
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#FF541F]" />
                <span><strong className="text-white/90">Enterprise:</strong> Configure custom server environments for running bots & backtests</span>
              </li>
            </ul>
          </div>

          {/* Visual left */}
          <div className="flex-1 flex justify-start">
            <MockTeamDashboard />
          </div>
        </div>
      </Container>
    </section>
  )
}
