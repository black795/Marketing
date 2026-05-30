import SettingsScreen from '@/components/koda-os/screens/SettingsScreen';
import { WorkflowShell } from '@/components/koda-os/shell';
import SandboxPanel from '@/components/settings/SandboxPanel';
import CaptionProviderPanel from '@/components/settings/CaptionProviderPanel';

export default function Page() {
  return (
    <WorkflowShell phase="settings" showCommandBar={false}>
      <SettingsScreen />
      <div style={{ padding: '0 48px 48px', maxWidth: 1100, margin: '0 auto' }}>
        <div
          style={{
            background: 'var(--bg-2)',
            border: '1px solid var(--line)',
            borderRadius: 14,
            padding: 24,
            marginBottom: 16,
          }}
        >
          <div
            className="mono upper"
            style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 14 }}
          >
            Sandbox Mode
          </div>
          <SandboxPanel />
        </div>
        <div
          style={{
            background: 'var(--bg-2)',
            border: '1px solid var(--line)',
            borderRadius: 14,
            padding: 24,
          }}
        >
          <div
            className="mono upper"
            style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 14 }}
          >
            Caption Provider
          </div>
          <CaptionProviderPanel />
        </div>
      </div>
    </WorkflowShell>
  );
}
