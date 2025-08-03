import json
import os
from typing import List, Dict, Any
from pathlib import Path

class QwenFormatConverter:
    def __init__(self):
        self.instruction_template = """회의록을 분석하여 구조화된 노션 프로젝트 기획안을 생성해주세요.

다음 회의 내용을 바탕으로:
1. 프로젝트명과 목적을 명확히 정의
2. 핵심 아이디어와 실행 계획 수립  
3. 구체적인 목표와 기대 효과 도출
4. 실무진과 일정 계획 포함

JSON 형식으로 응답해주세요."""

    def load_gold_standard_data(self, results_dir: str) -> List[Dict[str, Any]]:
        """골드 스탠다드 결과 폴더들을 스캔하여 데이터 로드"""
        results_path = Path(results_dir)
        gold_standard_data = []
        
        if not results_path.exists():
            print(f"[오류] 결과 디렉토리를 찾을 수 없습니다: {results_dir}")
            return []
        
        # 각 result 폴더 스캔
        for folder in results_path.iterdir():
            if folder.is_dir() and folder.name.startswith(('train_', 'val_')):
                result_file = folder / "result.json"
                if result_file.exists():
                    try:
                        with open(result_file, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                        gold_standard_data.append(data)
                        print(f"[로드] {folder.name}")
                    except Exception as e:
                        print(f"[오류] {folder.name} 로드 실패: {e}")
        
        return gold_standard_data
    
    def load_meeting_transcript(self, source_dir: str, meeting_folder: str) -> str:
        """원본 회의록 텍스트 로드"""
        meeting_path = Path(source_dir) / meeting_folder / "05_final_result.json"
        
        if not meeting_path.exists():
            print(f"[경고] 회의록 파일 없음: {meeting_path}")
            return ""
        
        try:
            with open(meeting_path, 'r', encoding='utf-8') as f:
                meeting_data = json.load(f)
            
            # 회의 내용을 텍스트로 변환
            meeting_text = ""
            for item in meeting_data:
                timestamp = item.get('timestamp', 'Unknown')
                speaker = item.get('speaker', 'Unknown')
                text = item.get('text', '')
                meeting_text += f"[{timestamp}] {speaker}: {text}\n"
            
            return meeting_text.strip()
        except Exception as e:
            print(f"[오류] 회의록 로드 실패 {meeting_path}: {e}")
            return ""
    
    def convert_to_qwen_format(self, gold_standard_data: List[Dict[str, Any]], 
                              source_dir: str = "batch_triplet_results") -> List[Dict[str, Any]]:
        """골드 스탠다드 데이터를 Qwen3 파인튜닝 형식으로 변환"""
        qwen_data = []
        
        for item in gold_standard_data:
            try:
                # 원본 회의록 로드
                source_folder = item.get('source_dir', '')
                if not source_folder:
                    print(f"[건너뜀] source_dir 없음: {item.get('id', 'Unknown')}")
                    continue
                
                meeting_transcript = self.load_meeting_transcript(
                    source_dir, f"result_{source_folder}"
                )
                
                if not meeting_transcript:
                    print(f"[건너뜀] 회의록 없음: {source_folder}")
                    continue
                
                # Qwen3 형식으로 변환
                qwen_item = {
                    "messages": [
                        {
                            "role": "system",
                            "content": "당신은 회의록을 분석하여 체계적인 노션 프로젝트 기획안을 생성하는 전문가입니다. 회의 내용을 정확히 분석하고 실무에서 바로 활용할 수 있는 구조화된 프로젝트 계획을 만들어주세요."
                        },
                        {
                            "role": "user", 
                            "content": f"{self.instruction_template}\n\n**회의록:**\n{meeting_transcript}"
                        },
                        {
                            "role": "assistant",
                            "content": json.dumps(item['notion_output'], ensure_ascii=False, indent=2)
                        }
                    ],
                    "metadata": {
                        "original_id": item.get('id', ''),
                        "source_dir": source_folder,
                        "quality_score": item.get('quality_metrics', {}).get('final_score', 0),
                        "is_high_quality": item.get('quality_metrics', {}).get('is_high_quality', False),
                        "dataset_type": item.get('metadata', {}).get('dataset_type', 'unknown')
                    }
                }
                
                qwen_data.append(qwen_item)
                print(f"[변환] {item.get('id', 'Unknown')} -> Qwen 형식")
                
            except Exception as e:
                print(f"[오류] 변환 실패 {item.get('id', 'Unknown')}: {e}")
                continue
        
        return qwen_data
    
    def save_qwen_datasets(self, qwen_data: List[Dict[str, Any]], output_dir: str):
        """Qwen 형식 데이터를 train/val로 분할하여 저장"""
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)
        
        # train/val 분할
        train_data = [item for item in qwen_data if item['metadata']['dataset_type'] == 'train']
        val_data = [item for item in qwen_data if item['metadata']['dataset_type'] == 'val']
        
        # 고품질 데이터만 필터링 (7점 이상)
        high_quality_train = [item for item in train_data if item['metadata']['is_high_quality']]
        high_quality_val = [item for item in val_data if item['metadata']['is_high_quality']]
        
        # 전체 데이터 저장
        train_file = output_path / "qwen_train_all.jsonl"
        val_file = output_path / "qwen_val_all.jsonl"
        
        with open(train_file, 'w', encoding='utf-8') as f:
            for item in train_data:
                f.write(json.dumps(item, ensure_ascii=False) + '\n')
        
        with open(val_file, 'w', encoding='utf-8') as f:
            for item in val_data:
                f.write(json.dumps(item, ensure_ascii=False) + '\n')
        
        # 고품질 데이터만 저장
        high_quality_train_file = output_path / "qwen_train_high_quality.jsonl"
        high_quality_val_file = output_path / "qwen_val_high_quality.jsonl"
        
        with open(high_quality_train_file, 'w', encoding='utf-8') as f:
            for item in high_quality_train:
                f.write(json.dumps(item, ensure_ascii=False) + '\n')
        
        with open(high_quality_val_file, 'w', encoding='utf-8') as f:
            for item in high_quality_val:
                f.write(json.dumps(item, ensure_ascii=False) + '\n')
        
        # 통계 출력
        print(f"\n[저장 완료] {output_dir}")
        print(f"전체 학습 데이터: {len(train_data)}개")
        print(f"전체 검증 데이터: {len(val_data)}개")
        print(f"고품질 학습 데이터: {len(high_quality_train)}개")
        print(f"고품질 검증 데이터: {len(high_quality_val)}개")
        
        # 품질 분포 출력
        train_scores = [item['metadata']['quality_score'] for item in train_data]
        val_scores = [item['metadata']['quality_score'] for item in val_data]
        
        if train_scores:
            print(f"학습 데이터 평균 품질: {sum(train_scores)/len(train_scores):.2f}/10")
        if val_scores:
            print(f"검증 데이터 평균 품질: {sum(val_scores)/len(val_scores):.2f}/10")

def main():
    print("[시작] 골드 스탠다드 -> Qwen3 형식 변환")
    print("=" * 50)
    
    converter = QwenFormatConverter()
    
    # 골드 스탠다드 데이터 로드
    results_dir = "ttalkkac_gold_standard_results_20250731_104912"
    print(f"[로딩] 골드 스탠다드 데이터 로드 중: {results_dir}")
    
    gold_standard_data = converter.load_gold_standard_data(results_dir)
    if not gold_standard_data:
        print("[오류] 골드 스탠다드 데이터를 찾을 수 없습니다.")
        return
    
    print(f"[로드 완료] 총 {len(gold_standard_data)}개 데이터")
    
    # Qwen 형식으로 변환
    print(f"[변환] Qwen3 형식으로 변환 중...")
    qwen_data = converter.convert_to_qwen_format(gold_standard_data)
    
    if not qwen_data:
        print("[오류] 변환된 데이터가 없습니다.")
        return
    
    print(f"[변환 완료] {len(qwen_data)}개 데이터 변환")
    
    # 저장
    output_dir = "qwen_finetune_data"
    print(f"[저장] {output_dir}에 저장 중...")
    converter.save_qwen_datasets(qwen_data, output_dir)
    
    print(f"\n[완료] Qwen3 파인튜닝 데이터 준비 완료!")
    print(f"📁 출력 폴더: {output_dir}")
    print("📄 파일:")
    print("  - qwen_train_all.jsonl (전체 학습 데이터)")
    print("  - qwen_val_all.jsonl (전체 검증 데이터)")  
    print("  - qwen_train_high_quality.jsonl (고품질 학습 데이터)")
    print("  - qwen_val_high_quality.jsonl (고품질 검증 데이터)")

if __name__ == "__main__":
    main()