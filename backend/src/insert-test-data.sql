-- 먼저 프로젝트가 있는지 확인하고 없으면 생성
DO $$
DECLARE
    project_id_var UUID;
BEGIN
    -- 기존 프로젝트 찾기 또는 새로 생성
    SELECT id INTO project_id_var FROM projects WHERE tenant_id = '83112360-d714-46a8-bdc3-a1a6bed3e10f' LIMIT 1;
    
    IF project_id_var IS NULL THEN
        -- 프로젝트가 없으면 먼저 SlackInput 생성
        INSERT INTO slack_inputs (id, tenant_id, slack_channel_id, slack_user_id, input_type, content, status)
        VALUES (gen_random_uuid(), '83112360-d714-46a8-bdc3-a1a6bed3e10f', 'C123456', 'U093FS28K4N', 'TEXT', '테스트 프로젝트 생성', 'COMPLETED')
        RETURNING id INTO project_id_var;
        
        -- 프로젝트 생성
        INSERT INTO projects (id, tenant_id, slack_input_id, title, overview, content)
        VALUES (gen_random_uuid(), '83112360-d714-46a8-bdc3-a1a6bed3e10f', project_id_var, '테스트 프로젝트', '테스트용 프로젝트입니다', '{}')
        RETURNING id INTO project_id_var;
    END IF;
    
    -- 이제 태스크 생성
    INSERT INTO tasks (
        id, 
        title, 
        description, 
        status, 
        priority,
        assignee_id,
        tenant_id,
        project_id,
        task_number,
        due_date,
        created_at,
        updated_at
    ) VALUES 
    (
        gen_random_uuid(),
        'AI 모델 성능 개선 작업',
        'WhisperX 모델의 정확도를 95% 이상으로 향상시키는 작업입니다. 현재 90% 수준이며, 파인튜닝을 통해 개선 예정입니다.',
        'IN_PROGRESS',
        'HIGH',
        '2a762e9a-da23-4d1c-aa71-5f88c2e306c3',
        '83112360-d714-46a8-bdc3-a1a6bed3e10f',
        project_id_var,
        'TASK-001',
        NOW() + INTERVAL '7 days',
        NOW(),
        NOW()
    ),
    (
        gen_random_uuid(),
        'Slack 통합 버그 수정',
        'Slack 메시지 전송 시 간헐적으로 발생하는 타임아웃 문제를 해결해야 합니다. ngrok 연동 관련 이슈로 추정됩니다.',
        'TODO',
        'HIGH',
        '2a762e9a-da23-4d1c-aa71-5f88c2e306c3',
        '83112360-d714-46a8-bdc3-a1a6bed3e10f',
        project_id_var,
        'TASK-002',
        NOW() + INTERVAL '3 days',
        NOW(),
        NOW()
    ),
    (
        gen_random_uuid(),
        '대시보드 UI 개선',
        '칸반보드 드래그앤드롭 기능을 개선하고 반응형 디자인을 적용해야 합니다. 모바일에서도 사용 가능하도록 개선이 필요합니다.',
        'TODO',
        'MEDIUM',
        '2a762e9a-da23-4d1c-aa71-5f88c2e306c3',
        '83112360-d714-46a8-bdc3-a1a6bed3e10f',
        project_id_var,
        'TASK-003',
        NOW() + INTERVAL '5 days',
        NOW(),
        NOW()
    ),
    (
        gen_random_uuid(),
        '회의록 자동 요약 기능 구현',
        'GPT-4를 활용한 회의록 자동 요약 및 액션아이템 추출 기능을 구현했습니다. 테스트 완료 후 배포 예정입니다.',
        'DONE',
        'HIGH',
        '2a762e9a-da23-4d1c-aa71-5f88c2e306c3',
        '83112360-d714-46a8-bdc3-a1a6bed3e10f',
        project_id_var,
        'TASK-004',
        NOW() - INTERVAL '2 days',
        NOW() - INTERVAL '10 days',
        NOW()
    ),
    (
        gen_random_uuid(),
        'Notion API 연동 테스트',
        'Notion 워크스페이스와의 데이터 동기화 기능을 테스트 중입니다. OAuth 연동은 완료되었고, 데이터 매핑 작업 진행 중입니다.',
        'IN_PROGRESS',
        'MEDIUM',
        '2a762e9a-da23-4d1c-aa71-5f88c2e306c3',
        '83112360-d714-46a8-bdc3-a1a6bed3e10f',
        project_id_var,
        'TASK-005',
        NOW() + INTERVAL '4 days',
        NOW() - INTERVAL '2 days',
        NOW()
    ),
    (
        gen_random_uuid(),
        '사용자 권한 관리 시스템',
        'RBAC 기반 사용자 권한 관리 시스템을 구현해야 합니다. Admin, Manager, Member 역할별 권한 설정이 필요합니다.',
        'TODO',
        'LOW',
        '2a762e9a-da23-4d1c-aa71-5f88c2e306c3',
        '83112360-d714-46a8-bdc3-a1a6bed3e10f',
        project_id_var,
        'TASK-006',
        NOW() + INTERVAL '14 days',
        NOW(),
        NOW()
    ),
    (
        gen_random_uuid(),
        'PostgreSQL 백업 자동화',
        '데이터베이스 백업을 자동화하는 스크립트를 작성해야 합니다. 매일 새벽 3시에 백업이 실행되도록 설정이 필요합니다.',
        'TODO',
        'MEDIUM',
        '2a762e9a-da23-4d1c-aa71-5f88c2e306c3',
        '83112360-d714-46a8-bdc3-a1a6bed3e10f',
        project_id_var,
        'TASK-007',
        NOW() + INTERVAL '10 days',
        NOW(),
        NOW()
    ),
    (
        gen_random_uuid(),
        'API 문서 작성',
        'Swagger를 사용하여 REST API 문서를 자동 생성하는 시스템을 구축 완료했습니다. 추가 엔드포인트 문서화 진행 중입니다.',
        'DONE',
        'LOW',
        '2a762e9a-da23-4d1c-aa71-5f88c2e306c3',
        '83112360-d714-46a8-bdc3-a1a6bed3e10f',
        project_id_var,
        'TASK-008',
        NOW() - INTERVAL '5 days',
        NOW() - INTERVAL '15 days',
        NOW()
    );
END $$;