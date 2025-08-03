import json
import os
from typing import List, Dict, Any
from openai import OpenAI
from datetime import datetime
from pathlib import Path
from prd_generation_prompts import generate_notion_project_prompt, generate_task_master_prd_prompt

class TtalkkakGoldStandardGenerator:
    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)
    
    def get_meeting_files(self, base_dir: str = "batch_triplet_results") -> List[str]:
        """05_final_result.json 파일들을 찾아서 반환"""
        target_files = []
        
        if os.path.exists(base_dir):
            for root, dirs, files in os.walk(base_dir):
                for file in files:
                    if file == "05_final_result.json":
                        target_files.append(os.path.join(root, file))
        
        return target_files
    
    def load_meeting_data(self, file_path: str) -> Dict[str, Any]:
        """회의 데이터를 로드하고 텍스트로 변환"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 회의 내용을 텍스트로 변환
            meeting_text = ""
            for item in data:
                timestamp = item.get('timestamp', 'Unknown')
                speaker = item.get('speaker', 'Unknown')
                text = item.get('text', '')
                meeting_text += f"[{timestamp}] {speaker}: {text}\n"
            
            return {
                "transcript": meeting_text.strip(),
                "metadata": {
                    "source_file": file_path,
                    "utterance_count": len(data),
                    "transcript_length": len(meeting_text),
                    "speakers": list(set(item.get('speaker', 'Unknown') for item in data))
                }
            }
        except Exception as e:
            print(f"파일 로드 오류 ({file_path}): {e}")
            return None
    
    def generate_initial_notion_response(self, meeting_transcript: str) -> Dict[str, Any]:
        """초기 노션 프로젝트 생성"""
        try:
            prompt = generate_notion_project_prompt(meeting_transcript)
            
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "당신은 회의록을 분석해서 구조화된 노션 프로젝트 기획안을 만드는 전문가입니다."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=4000
            )
            
            result = response.choices[0].message.content
            
            # JSON 파싱 시도
            try:
                parsed_result = json.loads(result)
                return {"success": True, "result": parsed_result}
            except json.JSONDecodeError:
                return {"success": True, "result": result}
                
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def evaluate_notion_response(self, meeting_transcript: str, initial_response: Any) -> Dict[str, Any]:
        """노션 응답 평가"""
        try:
            evaluation_prompt = f"""
다음 회의록을 기반으로 생성된 노션 프로젝트 기획안을 평가해주세요.

**회의록:**
{meeting_transcript}

**현재 기획안:**
{json.dumps(initial_response, ensure_ascii=False, indent=2)}

다음 JSON 형식으로 평가해주세요:
{{
    "1_to_5_점수": {{
        "회의내용_반영도": 점수,
        "구조화_품질": 점수,
        "실행가능성": 점수,
        "완성도": 점수
    }},
    "overall_score": 전체_평균점수,
    "strengths": ["장점1", "장점2"],
    "critical_issues": ["심각한문제1", "심각한문제2"],
    "missing_information": ["누락정보1", "누락정보2"],
    "improvement_suggestions": ["개선사항1", "개선사항2"]
}}

평가 기준: 각 1-5점 척도 (5점 만점)
"""
            
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "당신은 회의록 기반 프로젝트 기획안을 평가하는 전문가입니다."},
                    {"role": "user", "content": evaluation_prompt}
                ],
                temperature=0.3,
                max_tokens=2000
            )
            
            result = response.choices[0].message.content
            try:
                parsed_result = json.loads(result)
                return {"success": True, "result": parsed_result}
            except json.JSONDecodeError:
                return {"success": True, "result": {"evaluation": result, "overall_score": 3.0}}
                
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def refine_notion_response(self, meeting_transcript: str, initial_response: Any, evaluation: Dict) -> Dict[str, Any]:
        """노션 응답 개선"""
        try:
            refinement_prompt = f"""
회의록을 기반으로 한 노션 프로젝트 기획안을 개선해주세요.

**회의록:**
{meeting_transcript}

**현재 기획안:**
{json.dumps(initial_response, ensure_ascii=False, indent=2)}

**평가 결과:**
- 전체 점수: {evaluation.get('overall_score', 0)}/5
- 강점: {evaluation.get('strengths', [])}
- 심각한 문제: {evaluation.get('critical_issues', [])}
- 누락 정보: {evaluation.get('missing_information', [])}
- 개선 제안: {evaluation.get('improvement_suggestions', [])}

위 평가를 바탕으로 기획안을 개선해서 완벽한 노션 프로젝트 JSON을 생성해주세요.
"""
            
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "당신은 회의록을 분석해서 완벽한 노션 프로젝트 기획안을 만드는 전문가입니다."},
                    {"role": "user", "content": refinement_prompt}
                ],
                temperature=0.5,
                max_tokens=4000
            )
            
            result = response.choices[0].message.content
            try:
                parsed_result = json.loads(result)
                return {"success": True, "result": parsed_result}
            except json.JSONDecodeError:
                return {"success": True, "result": result}
                
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def generate_prd_from_notion(self, refined_notion: Any) -> Dict[str, Any]:
        """개선된 노션에서 PRD 생성"""
        try:
            prd_prompt = generate_task_master_prd_prompt(refined_notion)
            
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "당신은 노션 프로젝트를 기반으로 Task Master PRD를 생성하는 전문가입니다."},
                    {"role": "user", "content": prd_prompt}
                ],
                temperature=0.6,
                max_tokens=4000
            )
            
            result = response.choices[0].message.content
            try:
                parsed_result = json.loads(result)
                return {"success": True, "result": parsed_result}
            except json.JSONDecodeError:
                return {"success": True, "result": result}
                
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def final_quality_check(self, notion_result: Any, prd_result: Any) -> Dict[str, Any]:
        """최종 품질 검사"""
        try:
            quality_prompt = f"""
생성된 노션 프로젝트와 PRD의 최종 품질을 평가해주세요.

**노션 프로젝트:**
{json.dumps(notion_result, ensure_ascii=False, indent=2)}

**PRD 결과:**
{json.dumps(prd_result, ensure_ascii=False, indent=2)}

다음 JSON 형식으로 최종 평가해주세요:
{{
    "final_score": 전체_평균점수,
    "is_production_ready": true/false,
    "quality_breakdown": {{
        "notion_quality": 점수,
        "prd_quality": 점수,
        "consistency": 점수,
        "completeness": 점수
    }},
    "final_recommendations": ["최종권장사항1", "최종권장사항2"]
}}

평가 기준: 각 1-5점 척도 (5점 만점)
"""
            
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "당신은 프로젝트 산출물의 최종 품질을 평가하는 전문가입니다."},
                    {"role": "user", "content": quality_prompt}
                ],
                temperature=0.2,
                max_tokens=1500
            )
            
            result = response.choices[0].message.content
            try:
                parsed_result = json.loads(result)
                return {"success": True, "result": parsed_result}
            except json.JSONDecodeError:
                return {"success": True, "result": {"final_score": 3.0, "is_production_ready": True}}
                
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def generate_gold_standard_sample(self, meeting_transcript: str, metadata: Dict) -> Dict[str, Any]:
        """하나의 회의록에 대한 완전한 골드 스탠다드 생성"""
        
        # Stage 1: 초기 노션 응답 생성
        print("      🎯 Stage 1: 초기 노션 프로젝트 생성...")
        initial_notion = self.generate_initial_notion_response(meeting_transcript)
        if not initial_notion["success"]:
            return {"success": False, "error": f"Stage 1 실패: {initial_notion['error']}"}
        
        # Stage 2: 초기 응답 평가
        print("      📊 Stage 2: 초기 응답 품질 평가...")
        evaluation = self.evaluate_notion_response(meeting_transcript, initial_notion["result"])
        if not evaluation["success"]:
            return {"success": False, "error": f"Stage 2 실패: {evaluation['error']}"}
        
        iterations_used = 1
        final_notion = initial_notion["result"]
        
        # Stage 3: 필요시 개선 (품질이 4.3점 미만인 경우만)
        if evaluation["result"].get("overall_score", 0) < 4.3:
            print("      ⚡ Stage 3: 응답 개선 중...")
            refined_notion = self.refine_notion_response(
                meeting_transcript, 
                initial_notion["result"], 
                evaluation["result"]
            )
            if not refined_notion["success"]:
                return {"success": False, "error": f"Stage 3 실패: {refined_notion['error']}"}
            
            final_notion = refined_notion["result"]
            iterations_used = 2
        else:
            print("      ✅ Stage 3: 품질 우수로 개선 단계 생략")
        
        # Stage 4: PRD 생성
        print("      📋 Stage 4: PRD 생성...")
        prd_result = self.generate_prd_from_notion(final_notion)
        if not prd_result["success"]:
            return {"success": False, "error": f"Stage 4 실패: {prd_result['error']}"}
        
        # Stage 5: 최종 품질 검사
        print("      🔍 Stage 5: 최종 품질 검사...")
        final_quality = self.final_quality_check(final_notion, prd_result["result"])
        if not final_quality["success"]:
            return {"success": False, "error": f"Stage 5 실패: {final_quality['error']}"}
        
        return {
            "success": True,
            "notion_result": final_notion,
            "prd_result": prd_result["result"],
            "final_quality": final_quality["result"],
            "iterations_used": iterations_used
        }

def split_train_val(file_paths: List[str], train_ratio: float = 0.8) -> tuple:
    """파일을 학습/검증용으로 분할"""
    import random
    random.seed(42)  # 재현 가능한 결과
    
    shuffled_paths = file_paths.copy()
    random.shuffle(shuffled_paths)
    
    split_idx = int(len(shuffled_paths) * train_ratio)
    train_files = shuffled_paths[:split_idx]
    val_files = shuffled_paths[split_idx:]
    
    return train_files, val_files

def get_dir_name_from_path(file_path: str) -> str:
    """파일 경로에서 디렉토리 이름 추출"""
    return os.path.basename(os.path.dirname(file_path))

def print_processing_summary(processing_stats: Dict):
    """처리 요약 출력"""
    if processing_stats['processed'] > 0:
        print(f"   📈 처리 완료: {processing_stats['processed']}개")
        print(f"   ✅ 성공: {processing_stats['success']}개")
        print(f"   ❌ 실패: {processing_stats['failed']}개")
        print(f"   📈 성공률: {processing_stats['success']/processing_stats['processed']*100:.1f}%")

def process_dataset_batch(generator: TtalkkakGoldStandardGenerator, 
                         data_dirs: List[str], 
                         dataset_type: str,
                         stats: Dict) -> List[Dict]:
    """데이터셋 배치 처리"""
    dataset = []
    
    for i, file_path in enumerate(data_dirs):
        dir_name = get_dir_name_from_path(file_path)
        print(f"   📁 [{i+1}/{len(data_dirs)}] {dir_name} 처리 중...")
        
        # 중복 방지를 위한 백업 파일 생성
        backup_file = f"backup_{dataset_type}_{i+1:03d}_{dir_name}.json"
        try:
            meeting_data = generator.load_meeting_data(file_path)
            if not meeting_data:
                stats["failed"] += 1
                print(f"      💥 데이터 로드 실패")
                continue
            
            # 백업 저장
            with open(backup_file, 'w', encoding='utf-8') as f:
                json.dump(meeting_data, f, ensure_ascii=False, indent=2)
            
            meeting_transcript = meeting_data["transcript"]
            metadata = meeting_data["metadata"]
            
            print(f"      🔄 5단계 생성 프로세스 시작...")
            
            result = generator.generate_gold_standard_sample(meeting_transcript, metadata)
            stats["processed"] += 1
            
            if result["success"]:
                quality_score = result["final_quality"].get("final_score", 0)
                is_production_ready = result["final_quality"].get("is_production_ready", False)
                
                print(f"      📊 최종 품질: {quality_score}/5, 프로덕션 준비: {is_production_ready}")
                
                # 품질 기준 (관대하게 설정)
                if quality_score >= 3.5:  # 3.5점 이상이면 수용 (5점 척도)
                    training_sample = {
                        "id": f"{dataset_type}_{i+1:03d}",
                        "source_dir": dir_name,
                        "notion_output": result["notion_result"],
                        "prd_output": result["prd_result"],
                        "quality_metrics": {
                            "final_score": quality_score,
                            "is_production_ready": is_production_ready,
                            "iterations_used": result["iterations_used"]
                        },
                        "metadata": {
                            **metadata,
                            "dataset_type": dataset_type,
                            "processing_date": datetime.now().isoformat()
                        }
                    }
                    
                    dataset.append(training_sample)
                    stats["success"] += 1
                    print(f"      ✅ 저장 완료 (품질: {quality_score}/5)")
                else:
                    stats["failed"] += 1
                    print(f"      ❌ 품질 기준 미달 (점수: {quality_score}/5)")
            else:
                stats["failed"] += 1
                print(f"      💥 생성 실패: {result.get('error', 'Unknown error')}")
            
            # 백업 파일 정리
            if os.path.exists(backup_file):
                os.remove(backup_file)
                
        except Exception as e:
            stats["failed"] += 1
            stats["processed"] += 1
            print(f"      💥 처리 중 오류: {str(e)}")
            if os.path.exists(backup_file):
                os.remove(backup_file)
    
    return dataset

def save_final_datasets(train_dataset: List[Dict], val_dataset: List[Dict], stats: Dict):
    """최종 데이터셋 및 통계 저장"""
    
    # 결과 저장을 위한 폴더 생성
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_dir = Path(f"ttalkkac_gold_standard_results_{timestamp}")
    results_dir.mkdir(exist_ok=True)
    
    train_file = results_dir / "ttalkkac_train_gold_standard.json"
    val_file = results_dir / "ttalkkac_val_gold_standard.json"
    
    # 학습 데이터 저장
    with open(train_file, 'w', encoding='utf-8') as f:
        json.dump(train_dataset, f, ensure_ascii=False, indent=2)
    
    # 검증 데이터 저장
    with open(val_file, 'w', encoding='utf-8') as f:
        json.dump(val_dataset, f, ensure_ascii=False, indent=2)
    
    # 통계 계산 및 저장
    if train_dataset:
        train_quality_avg = sum(s["quality_metrics"]["final_score"] for s in train_dataset) / len(train_dataset)
        train_lengths = [s["metadata"]["transcript_length"] for s in train_dataset]
    else:
        train_quality_avg = 0
        train_lengths = []
        
    if val_dataset:
        val_quality_avg = sum(s["quality_metrics"]["final_score"] for s in val_dataset) / len(val_dataset)
        val_lengths = [s["metadata"]["transcript_length"] for s in val_dataset]
    else:
        val_quality_avg = 0
        val_lengths = []
    
    final_stats = {
        **stats,
        "end_time": datetime.now().isoformat(),
        "final_train_count": len(train_dataset),
        "final_val_count": len(val_dataset),
        "train_quality_average": train_quality_avg,
        "val_quality_average": val_quality_avg,
        "train_length_stats": {
            "min": min(train_lengths) if train_lengths else 0,
            "max": max(train_lengths) if train_lengths else 0,
            "avg": sum(train_lengths) / len(train_lengths) if train_lengths else 0
        },
        "val_length_stats": {
            "min": min(val_lengths) if val_lengths else 0,
            "max": max(val_lengths) if val_lengths else 0,
            "avg": sum(val_lengths) / len(val_lengths) if val_lengths else 0
        }
    }
    
    stats_file = results_dir / "ttalkkac_generation_statistics.json"
    with open(stats_file, 'w', encoding='utf-8') as f:
        json.dump(final_stats, f, ensure_ascii=False, indent=2)
    
    print(f"\n📁 저장된 파일들 ({results_dir}):")
    print(f"   📚 ttalkkac_train_gold_standard.json ({len(train_dataset)}개 샘플)")
    print(f"   🔍 ttalkkac_val_gold_standard.json ({len(val_dataset)}개 샘플)")
    print(f"   📊 ttalkkac_generation_statistics.json")
    print(f"\n📈 품질 통계:")
    print(f"   학습 데이터 평균 품질: {train_quality_avg:.2f}/5")
    print(f"   검증 데이터 평균 품질: {val_quality_avg:.2f}/5")

if __name__ == "__main__":
    # OpenAI API 키 설정
    API_KEY = os.getenv("OPENAI_API_KEY")
    if not API_KEY:
        print("❌ OPENAI_API_KEY 환경변수가 설정되지 않았습니다.")
        print("Windows: set OPENAI_API_KEY=your_api_key_here")
        print("Linux/Mac: export OPENAI_API_KEY=your_api_key_here")
        exit(1)
    
    print("🚀 TtalKkac 골드 스탠다드 데이터셋 생성 시작!")
    print("=" * 60)
    
    # 처리 통계
    stats = {
        "start_time": datetime.now().isoformat(),
        "processed": 0,
        "success": 0,
        "failed": 0
    }
    
    # 생성기 초기화
    generator = TtalkkakGoldStandardGenerator(api_key=API_KEY)
    
    # 회의 파일 목록 가져오기 (상대 경로로 변경)
    meeting_files = generator.get_meeting_files("../batch_triplet_results")
    if not meeting_files:
        print("❌ batch_triplet_results 폴더에서 05_final_result.json 파일을 찾을 수 없습니다.")
        exit(1)
    
    print(f"📊 발견된 회의 파일: {len(meeting_files)}개")
    
    # 학습/검증 데이터 분할
    train_dirs, val_dirs = split_train_val(meeting_files, train_ratio=0.8)
    print(f"📚 학습용: {len(train_dirs)}개")
    print(f"🔍 검증용: {len(val_dirs)}개")
    
    # 생성기 초기화
    generator = TtalkkakGoldStandardGenerator(api_key=API_KEY)
    
    # 결과 저장용
    train_dataset = []
    val_dataset = []
    
    print(f"\n📚 학습 데이터 생성 중...")
    print("=" * 40)
    train_dataset = process_dataset_batch(generator, train_dirs, "train", stats)
    
    print(f"\n🔍 검증 데이터 생성 중...")
    print("=" * 40)
    val_dataset = process_dataset_batch(generator, val_dirs, "val", stats)
    
    # 최종 저장
    print(f"\n💾 최종 데이터셋 저장 중...")
    save_final_datasets(train_dataset, val_dataset, stats)
    
    print(f"\n✅ 골드 스탠다드 생성 완료!")
    print("=" * 60)