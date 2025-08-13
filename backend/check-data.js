const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'ddalkkak_new',
  user: 'ddalkkak_user',
  password: 'postgres123'
});

async function checkData() {
  try {
    // 최근 프로젝트 조회
    const projectsResult = await pool.query(
      'SELECT * FROM projects ORDER BY created_at DESC LIMIT 3'
    );
    
    console.log('\n===== 최근 생성된 프로젝트 =====');
    if (projectsResult.rows.length > 0) {
      projectsResult.rows.forEach(p => {
        console.log(`\n프로젝트: ${p.name}`);
        console.log(`ID: ${p.id}`);
        console.log(`설명: ${p.description || '없음'}`);
        console.log(`시작일: ${p.start_date || '미정'}`);
        console.log(`마감일: ${p.end_date || '미정'}`);
        console.log(`생성일: ${p.created_at}`);
      });
    } else {
      console.log('생성된 프로젝트가 없습니다.');
    }
    
    // 최근 태스크 조회 
    const tasksResult = await pool.query(
      'SELECT t.*, p.name as project_name FROM tasks t LEFT JOIN projects p ON t.project_id = p.id ORDER BY t.created_at DESC LIMIT 10'
    );
    
    console.log('\n===== 최근 생성된 태스크 =====');
    if (tasksResult.rows.length > 0) {
      tasksResult.rows.forEach((t, i) => {
        console.log(`\n${i+1}. ${t.title}`);
        console.log(`   프로젝트: ${t.project_name || '없음'}`);
        console.log(`   설명: ${t.description ? t.description.substring(0, 100) : '없음'}...`);
        console.log(`   우선순위: ${t.priority || 'medium'}`);
        console.log(`   상태: ${t.status || 'pending'}`);
        console.log(`   예상시간: ${t.estimated_hours || 0}시간`);
        console.log(`   시작일: ${t.start_date || '미정'}`);
        console.log(`   마감일: ${t.due_date || '미정'}`);
        console.log(`   생성일: ${t.created_at}`);
      });
    } else {
      console.log('생성된 태스크가 없습니다.');
    }
    
    // 서브태스크 개수 조회
    const subtasksResult = await pool.query(
      'SELECT COUNT(*) as count FROM subtasks'
    );
    console.log(`\n===== 서브태스크 통계 =====`);
    console.log(`총 서브태스크 수: ${subtasksResult.rows[0].count}개`);
    
    // 최근 회의록 조회
    const meetingNotesResult = await pool.query(
      'SELECT * FROM meeting_notes ORDER BY created_at DESC LIMIT 3'
    );
    
    console.log('\n===== 최근 회의록 =====');
    if (meetingNotesResult.rows.length > 0) {
      meetingNotesResult.rows.forEach(m => {
        console.log(`\n회의록 ID: ${m.id}`);
        console.log(`프로젝트 ID: ${m.project_id || '없음'}`);
        console.log(`회의 날짜: ${m.meeting_date || m.created_at}`);
        const content = m.content ? JSON.parse(m.content) : {};
        console.log(`요약: ${content.summary ? content.summary.substring(0, 200) : '없음'}...`);
        console.log(`생성일: ${m.created_at}`);
      });
    } else {
      console.log('생성된 회의록이 없습니다.');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkData();