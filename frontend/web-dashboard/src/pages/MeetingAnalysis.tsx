import { useState } from 'react';
import { Search, Edit3, Download, Plus, ChevronRight, FileText } from 'lucide-react';

const MeetingAnalysis = () => {
  const [searchFilters, setSearchFilters] = useState({
    meetingName: '',
    date: '',
    participants: ''
  });

  const meetingData = {
    summary: {
      purpose: '회의 목적:',
      mainContent: '주요 내용:',
      decisions: '결정 사항 및 다음 단계:'
    },
    derivedTasks: [
      { id: 1, name: 'd', assignee: '텍스트', dueDate: '텍스트', status: '완료', statusColor: 'bg-green-500' },
      { id: 2, name: '', assignee: '텍스트', dueDate: '텍스트', status: '진행 중', statusColor: 'bg-blue-500' },
      { id: 3, name: '', assignee: '', dueDate: '', status: '예정', statusColor: 'bg-orange-500' }
    ],
    keywords: ['모델 결과 정리', '피드백 정리', '회의실 예약'],
    nextMeeting: {
      title: '▶ 다음 회의: 07.19 (수)',
      details: [
        '- 진행사: 김미정',
        '- 준비사항: 모델 결과 비교표, UI 피드백 수합본',
        '- 체크리스트:'
      ],
      checklist: [
        { text: '모델 결과 정리', completed: false },
        { text: '피드백 정리', completed: false },
        { text: '회의실 예약', completed: false }
      ]
    },
    relatedDocs: '→ 전 회의 요약본 (07.03) [열기]'
  };

  return (
    <div className="flex h-full bg-gray-100">
      {/* Main Content */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold mb-6">회의 분석</h1>
          
          {/* Search Filters */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">회의명:</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="회의명"
                  value={searchFilters.meetingName}
                  onChange={(e) => setSearchFilters({...searchFilters, meetingName: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md pr-10"
                />
                <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">일시:</label>
              <input
                type="date"
                value={searchFilters.date}
                onChange={(e) => setSearchFilters({...searchFilters, date: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">참석자:</label>
              <input
                type="text"
                placeholder="참석자"
                value={searchFilters.participants}
                onChange={(e) => setSearchFilters({...searchFilters, participants: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>
        </div>

        {/* Meeting Summary Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">회의 요약</h2>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md flex items-center gap-2">
                <Edit3 className="w-4 h-4" />
                요약 수정
              </button>
              <button className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md flex items-center gap-2">
                <Download className="w-4 h-4" />
                회의록 다운로드
              </button>
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-2">
                <Plus className="w-4 h-4" />
                새 업무 생성
              </button>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="font-medium text-gray-700 mb-2">{meetingData.summary.purpose}</div>
              <div className="text-gray-600">{meetingData.summary.mainContent}</div>
              <div className="text-gray-600 mt-2">{meetingData.summary.decisions}</div>
            </div>
          </div>
        </div>

        {/* Derived Tasks Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">파생 업무</h2>
          
          <div className="mb-4 grid grid-cols-4 gap-4 text-sm font-medium text-gray-700">
            <div>업무명:</div>
            <div>담당자:</div>
            <div>마감일:</div>
            <div>우선순위:</div>
          </div>
          
          <div className="space-y-2">
            {meetingData.derivedTasks.map((task) => (
              <div key={task.id} className="grid grid-cols-4 gap-4 p-3 bg-gray-50 rounded-md">
                <div className="text-sm">{task.name}</div>
                <div className="text-sm">{task.assignee}</div>
                <div className="text-sm">{task.dueDate}</div>
                <div>
                  <span className={`px-2 py-1 text-xs text-white rounded-full ${task.statusColor}`}>
                    {task.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-80 bg-white shadow-lg p-6">
        {/* Keywords Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">핵심 키워드</h3>
          <div className="grid grid-cols-1 gap-2">
            {meetingData.keywords.map((keyword, index) => (
              <div key={index} className="bg-gray-100 p-2 rounded text-sm text-center">
                {keyword}
              </div>
            ))}
          </div>
        </div>

        {/* Next Meeting Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">{meetingData.nextMeeting.title}</h3>
          <div className="space-y-2">
            {meetingData.nextMeeting.details.map((detail, index) => (
              <div key={index} className="text-sm text-gray-600">
                {detail}
              </div>
            ))}
          </div>
          
          {/* Checklist */}
          <div className="mt-4 space-y-2">
            {meetingData.nextMeeting.checklist.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  checked={item.completed}
                  className="w-4 h-4 rounded border-gray-300"
                  onChange={() => {
                    // 체크박스 상태 변경 로직
                  }}
                />
                <span className="text-sm text-gray-600">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Related Documents Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">관련 문서 및 참고 자료</h3>
          <div className="space-y-2">
            <button className="w-full text-left text-sm text-blue-600 hover:text-blue-800 flex items-center gap-2">
              <ChevronRight className="w-4 h-4" />
              <span>{meetingData.relatedDocs}</span>
            </button>
          </div>
          
          {/* Meeting Notes Upload */}
          <div className="mt-4">
            <div className="border-2 border-dashed border-gray-300 rounded-md p-4 text-center">
              <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <div className="text-sm text-gray-600 mb-2">회의 녹음 파일</div>
              <button className="text-xs text-blue-600 hover:text-blue-800">
                파일 업로드
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingAnalysis; 