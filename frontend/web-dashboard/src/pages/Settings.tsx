import { useState } from 'react';
import { User, Bell, Palette, Lock, Save } from 'lucide-react';

const Settings = () => {
  const [settings, setSettings] = useState({
    profile: {
      name: '사용자',
      email: 'user@example.com',
      role: '개발자',
      department: 'IT팀'
    },
    notifications: {
      email: true,
      push: true,
      meeting: true,
      deadline: true
    },
    appearance: {
      theme: 'light',
      language: 'ko'
    },
    privacy: {
      profileVisible: true,
      shareAnalytics: false
    }
  });

  const handleSave = () => {
    // 설정 저장 로직
    console.log('Settings saved:', settings);
  };

  return (
    <div className="p-6 bg-gray-100 h-full overflow-auto">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">설정</h1>

        <div className="space-y-6">
          {/* Profile Settings */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <User className="w-5 h-5 mr-2 text-blue-600" />
              <h2 className="text-lg font-semibold">프로필 설정</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">이름</label>
                <input
                  type="text"
                  value={settings.profile.name}
                  onChange={(e) => setSettings({
                    ...settings,
                    profile: { ...settings.profile, name: e.target.value }
                  })}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">이메일</label>
                <input
                  type="email"
                  value={settings.profile.email}
                  onChange={(e) => setSettings({
                    ...settings,
                    profile: { ...settings.profile, email: e.target.value }
                  })}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">역할</label>
                <input
                  type="text"
                  value={settings.profile.role}
                  onChange={(e) => setSettings({
                    ...settings,
                    profile: { ...settings.profile, role: e.target.value }
                  })}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">부서</label>
                <input
                  type="text"
                  value={settings.profile.department}
                  onChange={(e) => setSettings({
                    ...settings,
                    profile: { ...settings.profile, department: e.target.value }
                  })}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <Bell className="w-5 h-5 mr-2 text-blue-600" />
              <h2 className="text-lg font-semibold">알림 설정</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">이메일 알림</span>
                <input
                  type="checkbox"
                  checked={settings.notifications.email}
                  onChange={(e) => setSettings({
                    ...settings,
                    notifications: { ...settings.notifications, email: e.target.checked }
                  })}
                  className="h-4 w-4 text-blue-600 rounded"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">푸시 알림</span>
                <input
                  type="checkbox"
                  checked={settings.notifications.push}
                  onChange={(e) => setSettings({
                    ...settings,
                    notifications: { ...settings.notifications, push: e.target.checked }
                  })}
                  className="h-4 w-4 text-blue-600 rounded"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">회의 알림</span>
                <input
                  type="checkbox"
                  checked={settings.notifications.meeting}
                  onChange={(e) => setSettings({
                    ...settings,
                    notifications: { ...settings.notifications, meeting: e.target.checked }
                  })}
                  className="h-4 w-4 text-blue-600 rounded"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">마감일 알림</span>
                <input
                  type="checkbox"
                  checked={settings.notifications.deadline}
                  onChange={(e) => setSettings({
                    ...settings,
                    notifications: { ...settings.notifications, deadline: e.target.checked }
                  })}
                  className="h-4 w-4 text-blue-600 rounded"
                />
              </div>
            </div>
          </div>

          {/* Appearance Settings */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <Palette className="w-5 h-5 mr-2 text-blue-600" />
              <h2 className="text-lg font-semibold">화면 설정</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">테마</label>
                <select
                  value={settings.appearance.theme}
                  onChange={(e) => setSettings({
                    ...settings,
                    appearance: { ...settings.appearance, theme: e.target.value }
                  })}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="light">라이트</option>
                  <option value="dark">다크</option>
                  <option value="auto">자동</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">언어</label>
                <select
                  value={settings.appearance.language}
                  onChange={(e) => setSettings({
                    ...settings,
                    appearance: { ...settings.appearance, language: e.target.value }
                  })}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="ko">한국어</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
          </div>

          {/* Privacy Settings */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <Lock className="w-5 h-5 mr-2 text-blue-600" />
              <h2 className="text-lg font-semibold">개인정보 설정</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">프로필 공개</span>
                <input
                  type="checkbox"
                  checked={settings.privacy.profileVisible}
                  onChange={(e) => setSettings({
                    ...settings,
                    privacy: { ...settings.privacy, profileVisible: e.target.checked }
                  })}
                  className="h-4 w-4 text-blue-600 rounded"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">분석 데이터 공유</span>
                <input
                  type="checkbox"
                  checked={settings.privacy.shareAnalytics}
                  onChange={(e) => setSettings({
                    ...settings,
                    privacy: { ...settings.privacy, shareAnalytics: e.target.checked }
                  })}
                  className="h-4 w-4 text-blue-600 rounded"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              설정 저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings; 