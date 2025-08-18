import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TaskInfo {
  id: string;
  title: string;
  description: string;
  requiredSkills: string[];
  taskType: string;
  estimatedHours: number;
  complexity: string;
  priority: string;
}

interface UserSkillProfile {
  id: string;
  name: string;
  skills: string[];
  preferredTypes: string[];
  currentWorkload?: number;
}

interface AssignmentResult {
  userId: string;
  userName: string;
  score: number;
  reason: string;
  breakdown: {
    skillMatch: number;
    skillScore: number;
    typeMatch: boolean;
    typeScore: number;
    availabilityScore: number;
    currentWorkload: number;
  };
}

export class SmartAssignmentService {
  /**
   * 팀원들의 현재 워크로드 계산
   */
  private async calculateUserWorkload(userId: string, tenantId: string): Promise<number> {
    try {
      const activeTasks = await prisma.task.count({
        where: {
          assigneeId: userId,
          tenantId,
          status: {
            in: ['TODO', 'IN_PROGRESS']
          }
        }
      });

      const totalEstimatedHours = await prisma.task.findMany({
        where: {
          assigneeId: userId,
          tenantId,
          status: {
            in: ['TODO', 'IN_PROGRESS']
          }
        },
        include: {
          metadata: true
        }
      });

      const totalHours = totalEstimatedHours.reduce((sum, task) => {
        return sum + (task.metadata?.estimatedHours || 8);
      }, 0);

      return totalHours;
    } catch (error) {
      console.error(`워크로드 계산 실패: ${error}`);
      return 0;
    }
  }

  /**
   * 태스크와 사용자 간 매칭 점수 계산
   */
  private calculateMatchScore(
    user: UserSkillProfile,
    task: TaskInfo,
    currentWorkload: number
  ): AssignmentResult {
    let totalScore = 0;
    const breakdown = {
      skillMatch: 0,
      skillScore: 0,
      typeMatch: false,
      typeScore: 0,
      availabilityScore: 0,
      currentWorkload
    };

    // 1. 기술 매칭 (50점 만점)
    const requiredSkills = task.requiredSkills || [];
    const userSkills = user.skills || [];
    
    if (requiredSkills.length > 0) {
      const matchedSkills = requiredSkills.filter(skill => 
        userSkills.includes(skill)
      );
      breakdown.skillMatch = matchedSkills.length;
      breakdown.skillScore = (matchedSkills.length / requiredSkills.length) * 50;
      totalScore += breakdown.skillScore;
    } else {
      // 필요 기술이 명시되지 않은 경우 기본 점수
      breakdown.skillScore = 25;
      totalScore += 25;
    }

    // 2. 작업 유형 선호도 (30점 만점)
    const preferredTypes = user.preferredTypes || [];
    if (task.taskType && preferredTypes.includes(task.taskType)) {
      breakdown.typeMatch = true;
      breakdown.typeScore = 30;
      totalScore += 30;
    } else if (!task.taskType) {
      // 작업 유형이 명시되지 않은 경우 기본 점수
      breakdown.typeScore = 15;
      totalScore += 15;
    }

    // 3. 가용성 (20점 만점)
    // 현재 워크로드가 적을수록 높은 점수
    if (currentWorkload < 20) {
      breakdown.availabilityScore = 20;
    } else if (currentWorkload < 40) {
      breakdown.availabilityScore = 15;
    } else if (currentWorkload < 60) {
      breakdown.availabilityScore = 10;
    } else if (currentWorkload < 80) {
      breakdown.availabilityScore = 5;
    } else {
      breakdown.availabilityScore = 0;
    }
    totalScore += breakdown.availabilityScore;

    // 할당 이유 생성
    const reasons = [];
    if (breakdown.skillMatch > 0) {
      reasons.push(`${breakdown.skillMatch}/${requiredSkills.length}개 기술 매치`);
    }
    if (breakdown.typeMatch) {
      reasons.push('선호 작업 유형 일치');
    }
    if (breakdown.availabilityScore >= 15) {
      reasons.push('여유 시간 충분');
    } else if (breakdown.availabilityScore >= 10) {
      reasons.push('적절한 여유 시간');
    }

    return {
      userId: user.id,
      userName: user.name,
      score: totalScore,
      reason: reasons.length > 0 ? reasons.join(', ') : '기본 매칭',
      breakdown
    };
  }

  /**
   * 최적의 담당자 찾기
   */
  async findBestAssignee(task: TaskInfo, tenantId: string): Promise<AssignmentResult | null> {
    try {
      // 1. 팀원 목록 가져오기
      const users = await prisma.user.findMany({
        where: {
          tenantId
          // 모든 팀원 포함 (OWNER, ADMIN, MEMBER)
        },
        select: {
          id: true,
          name: true,
          skills: true,
          preferredTypes: true
        }
      });

      if (users.length === 0) {
        console.log('❌ 할당 가능한 팀원이 없습니다');
        return null;
      }

      // 2. 각 사용자별 점수 계산
      const scoredUsers: AssignmentResult[] = [];
      
      for (const user of users) {
        const workload = await this.calculateUserWorkload(user.id, tenantId);
        
        const userProfile: UserSkillProfile = {
          id: user.id,
          name: user.name || 'Unknown',
          skills: (user.skills as string[]) || [],
          preferredTypes: (user.preferredTypes as string[]) || [],
          currentWorkload: workload
        };

        const score = this.calculateMatchScore(userProfile, task, workload);
        scoredUsers.push(score);
      }

      // 3. 점수가 가장 높은 사용자 선택
      scoredUsers.sort((a, b) => b.score - a.score);
      const bestMatch = scoredUsers[0];

      if (!bestMatch) {
        console.log('❌ 매칭 가능한 사용자가 없습니다');
        return null;
      }

      console.log(`🎯 최적 담당자: ${bestMatch.userName} (점수: ${bestMatch.score})`);
      console.log(`   - 기술 매치: ${bestMatch.breakdown.skillMatch}개`);
      console.log(`   - 작업 유형: ${bestMatch.breakdown.typeMatch ? '일치' : '불일치'}`);
      console.log(`   - 현재 워크로드: ${bestMatch.breakdown.currentWorkload}시간`);

      return bestMatch;

    } catch (error) {
      console.error('담당자 매칭 실패:', error);
      return null;
    }
  }

  /**
   * 태스크에 담당자 할당
   */
  async assignTaskToUser(
    taskId: string,
    userId: string,
    score: number,
    reason: string
  ): Promise<void> {
    try {
      // Task 업데이트
      await prisma.task.update({
        where: { id: taskId },
        data: { assigneeId: userId }
      });

      // TaskMetadata 업데이트
      const metadata = await prisma.taskMetadata.findUnique({
        where: { taskId }
      });

      if (metadata) {
        await prisma.taskMetadata.update({
          where: { taskId },
          data: {
            assignmentScore: score,
            assignmentReason: reason
          }
        });
      }

      console.log(`✅ 태스크 ${taskId}를 사용자 ${userId}에게 할당 완료`);
    } catch (error) {
      console.error('태스크 할당 실패:', error);
      throw error;
    }
  }

  /**
   * 할당 로그 저장
   */
  async logAssignment(result: AssignmentResult, taskId: string): Promise<void> {
    try {
      await prisma.taskAssignmentLog.create({
        data: {
          taskId,
          userId: result.userId,
          assignmentScore: result.score,
          reason: result.reason,
          scoreBreakdown: result.breakdown,
          algorithmVersion: '2.0' // 기술 매칭 버전
        }
      });
    } catch (error) {
      console.error('할당 로그 저장 실패:', error);
      // 로그 실패는 무시 (주요 기능 아님)
    }
  }

  /**
   * 메인 함수: 태스크에 최적 담당자 찾아서 할당
   */
  async assignBestUser(task: TaskInfo, tenantId: string): Promise<AssignmentResult | null> {
    const result = await this.findBestAssignee(task, tenantId);
    
    if (result && task.id) {
      await this.assignTaskToUser(task.id, result.userId, result.score, result.reason);
    }
    
    return result;
  }
}

// 싱글톤 인스턴스
export const smartAssigner = new SmartAssignmentService();