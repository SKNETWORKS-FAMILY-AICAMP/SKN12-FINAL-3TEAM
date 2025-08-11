-- 로그인한 사용자를 위한 테스트 데이터 생성
-- 먼저 사용자 ID를 확인하세요:
-- SELECT id, name, email FROM "User" WHERE email = 'romanho42@gmail.com';

-- 사용자 ID를 변수로 설정 (실제 사용자 ID로 교체하세요)
-- 예: 'slack-U07V5CEKAKL' 또는 데이터베이스에서 확인한 실제 ID

-- 테스트 업무 데이터 삽입
-- assigneeId를 실제 로그인한 사용자의 ID로 변경하세요

INSERT INTO "Task" (
    id, 
    title, 
    description, 
    status, 
    priority,
    "assigneeId",
    "createdBy",
    "tenantId",
    "dueDate",
    "createdAt",
    "updatedAt"
) VALUES 
(
    gen_random_uuid(),
    'AI 모델 성능 개선 작업',
    'WhisperX 모델의 정확도를 95% 이상으로 향상시키는 작업',
    'IN_PROGRESS',
    'HIGH',
    'slack-U07V5CEKAKL', -- 실제 사용자 ID로 변경
    'slack-U07V5CEKAKL', -- 실제 사용자 ID로 변경
    'default-tenant-id',
    NOW() + INTERVAL '7 days',
    NOW(),
    NOW()
),
(
    gen_random_uuid(),
    'Slack 통합 버그 수정',
    'Slack 메시지 전송 시 간헐적으로 발생하는 타임아웃 문제 해결',
    'TODO',
    'HIGH',
    'slack-U07V5CEKAKL', -- 실제 사용자 ID로 변경
    'slack-U07V5CEKAKL', -- 실제 사용자 ID로 변경
    'default-tenant-id',
    NOW() + INTERVAL '3 days',
    NOW(),
    NOW()
),
(
    gen_random_uuid(),
    '대시보드 UI 개선',
    '칸반보드 드래그앤드롭 기능 개선 및 반응형 디자인 적용',
    'TODO',
    'MEDIUM',
    'slack-U07V5CEKAKL', -- 실제 사용자 ID로 변경
    'slack-U07V5CEKAKL', -- 실제 사용자 ID로 변경
    'default-tenant-id',
    NOW() + INTERVAL '5 days',
    NOW(),
    NOW()
),
(
    gen_random_uuid(),
    '회의록 자동 요약 기능 구현',
    'GPT-4를 활용한 회의록 자동 요약 및 액션아이템 추출 기능',
    'DONE',
    'HIGH',
    'slack-U07V5CEKAKL', -- 실제 사용자 ID로 변경
    'slack-U07V5CEKAKL', -- 실제 사용자 ID로 변경
    'default-tenant-id',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '10 days',
    NOW()
),
(
    gen_random_uuid(),
    'Notion API 연동 테스트',
    'Notion 워크스페이스와의 데이터 동기화 기능 테스트',
    'IN_PROGRESS',
    'MEDIUM',
    'slack-U07V5CEKAKL', -- 실제 사용자 ID로 변경
    'slack-U07V5CEKAKL', -- 실제 사용자 ID로 변경
    'default-tenant-id',
    NOW() + INTERVAL '4 days',
    NOW() - INTERVAL '2 days',
    NOW()
),
(
    gen_random_uuid(),
    '사용자 권한 관리 시스템',
    'RBAC 기반 사용자 권한 관리 시스템 구현',
    'TODO',
    'LOW',
    'slack-U07V5CEKAKL', -- 실제 사용자 ID로 변경
    'slack-U07V5CEKAKL', -- 실제 사용자 ID로 변경
    'default-tenant-id',
    NOW() + INTERVAL '14 days',
    NOW(),
    NOW()
);

-- 실행 방법:
-- 1. 먼저 실제 사용자 ID 확인:
--    SELECT id, name, email, "slackUserId" FROM "User" WHERE email = 'romanho42@gmail.com';
-- 
-- 2. 위 스크립트에서 'slack-U07V5CEKAKL'를 실제 사용자 ID로 모두 변경
--
-- 3. PostgreSQL에서 실행:
--    psql -U ddalkkak_user -d ddalkkak_new -f test-data.sql
--
-- 또는 직접 실행:
--    psql -U ddalkkak_user -d ddalkkak_new
--    그 다음 위 SQL 붙여넣기