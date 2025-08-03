import json
import os
import torch
from typing import List, Dict, Any
from pathlib import Path
from datetime import datetime
from transformers import (
    AutoTokenizer, 
    AutoModelForCausalLM,
    TrainingArguments,
    Trainer,
    DataCollatorForSeq2Seq
)
from peft import LoraConfig, get_peft_model, TaskType
from datasets import Dataset
import logging
from meeting_analysis_prompts import generate_meeting_analysis_system_prompt, generate_meeting_analysis_user_prompt

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TtalkkacDatasetConverter:
    """실제 프로젝트에서 사용하는 프롬프트와 데이터 형식으로 골드 스탠다드를 변환"""
    
    def __init__(self):
        # 골드 스탠다드와 동일한 프롬프트 사용
        self.system_prompt = generate_meeting_analysis_system_prompt()
        # user_prompt_template은 동적으로 생성하므로 메서드에서 처리

    def chunk_text(self, text: str, chunk_size: int = 5000, overlap: int = 512) -> List[str]:
        """텍스트를 청킹하여 나누기 (골드 스탠다드와 동일한 방식)"""
        if len(text) <= chunk_size:
            return [text]
        
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + chunk_size
            
            if end >= len(text):
                chunk = text[start:]
            else:
                chunk = text[start:end]
                
                # 마지막 완전한 문장에서 끊기 시도
                last_period = chunk.rfind('.')
                last_newline = chunk.rfind('\n')
                break_point = max(last_period, last_newline)
                
                if break_point > start + chunk_size // 2:
                    chunk = text[start:break_point + 1]
                    end = break_point + 1
            
            chunks.append(chunk.strip())
            
            if end >= len(text):
                break
                
            start = end - overlap
        
        return chunks

    def load_gold_standard_data(self, results_dir: str) -> List[Dict[str, Any]]:
        """골드 스탠다드 결과 폴더에서 데이터 로드"""
        results_path = Path(results_dir)
        data = []
        
        if not results_path.exists():
            logger.error(f"결과 디렉토리를 찾을 수 없습니다: {results_dir}")
            return []
        
        # 성공적으로 생성된 result.json 파일들 스캔
        for folder in results_path.iterdir():
            if folder.is_dir() and folder.name.startswith(('train_', 'val_')):
                result_file = folder / "result.json"
                if result_file.exists():
                    try:
                        with open(result_file, 'r', encoding='utf-8') as f:
                            item = json.load(f)
                        data.append(item)
                        logger.info(f"로드: {folder.name}")
                    except Exception as e:
                        logger.error(f"{folder.name} 로드 실패: {e}")
        
        logger.info(f"총 {len(data)}개 골드 스탠다드 데이터 로드 완료")
        return data

    def load_meeting_content(self, source_dir: str, meeting_folder: str) -> str:
        """원본 회의 내용 로드 (batch_triplet_results에서)"""
        # result_ 접두사가 이미 있는지 확인
        if meeting_folder.startswith("result_"):
            meeting_path = Path(source_dir) / meeting_folder / "05_final_result.json"
        else:
            meeting_path = Path(source_dir) / f"result_{meeting_folder}" / "05_final_result.json"
        
        if not meeting_path.exists():
            logger.warning(f"회의록 파일 없음: {meeting_path}")
            return ""
        
        try:
            with open(meeting_path, 'r', encoding='utf-8') as f:
                meeting_data = json.load(f)
            
            # 실제 프로젝트에서 사용하는 형식으로 회의 내용 구성
            meeting_text = ""
            for item in meeting_data:
                timestamp = item.get('timestamp', 'Unknown')
                speaker = item.get('speaker', 'Unknown')
                text = item.get('text', '')
                meeting_text += f"[{timestamp}] {speaker}: {text}\n"
            
            return meeting_text.strip()
        except Exception as e:
            logger.error(f"회의록 로드 실패 {meeting_path}: {e}")
            return ""

    def convert_to_training_format(self, gold_data: List[Dict[str, Any]], 
                                 source_dir: str = "batch_triplet_results") -> List[Dict[str, str]]:
        """골드 스탠다드를 Qwen3 파인튜닝 형식으로 변환 (청킹 지원)"""
        training_data = []
        
        for item in gold_data:
            try:
                metadata = item.get('metadata', {})
                source_file = metadata.get('source_file', '')
                is_chunk = metadata.get('is_chunk', False)
                
                logger.info(f"처리 중: {item.get('id', 'Unknown')}, 청킹여부: {is_chunk}")
                
                if not source_file:
                    logger.warning(f"source_file 없음: {item.get('id', 'Unknown')}")
                    continue
                
                # source_file에서 실제 폴더명 추출
                if 'result_' in source_file:
                    temp = source_file.split('result_', 1)[1]
                    source_folder = temp.replace('\\05_final_result.json', '').replace('/05_final_result.json', '')
                else:
                    source_folder = source_file.replace('train_', '').replace('val_', '')
                
                # 원본 회의 내용 로드
                full_meeting_content = self.load_meeting_content(source_dir, source_folder)
                if not full_meeting_content:
                    logger.warning(f"회의 내용 없음: {source_folder}")
                    continue
                
                # 청킹된 데이터인지 확인하고 처리
                if is_chunk and 'chunk_info' in item:
                    # 청킹된 데이터: 해당 청크만 추출
                    chunk_info = item['chunk_info']
                    chunk_index = chunk_info.get('chunk_index', 1) - 1  # 0-based index
                    
                    # 동일한 청킹 방식으로 원본 텍스트 분할
                    chunks = self.chunk_text(full_meeting_content, chunk_size=5000, overlap=512)
                    
                    if chunk_index < len(chunks):
                        meeting_content = chunks[chunk_index]
                        logger.info(f"청크 {chunk_index+1}/{len(chunks)} 사용 (길이: {len(meeting_content)}자)")
                    else:
                        logger.warning(f"청크 인덱스 초과: {chunk_index+1} > {len(chunks)}")
                        continue
                else:
                    # 일반 데이터: 전체 회의록 사용
                    meeting_content = full_meeting_content
                    logger.info(f"전체 회의록 사용 (길이: {len(meeting_content)}자)")
                
                # 골드 스탠다드와 동일한 프롬프트 생성
                user_message = generate_meeting_analysis_user_prompt(meeting_content)
                
                # 골드 스탠다드 응답 처리
                notion_output = item.get('notion_output', {})
                if not notion_output:
                    logger.warning(f"notion_output 없음: {item.get('id', 'Unknown')}")
                    continue
                
                # JSON 문자열인 경우 파싱
                if isinstance(notion_output, str):
                    try:
                        notion_output = json.loads(notion_output)
                    except:
                        logger.warning(f"JSON 파싱 실패: {item.get('id', 'Unknown')}")
                        continue
                    
                assistant_response = json.dumps(notion_output, ensure_ascii=False, indent=2)
                
                # Qwen3 채팅 형식으로 구성
                conversation = f"<|im_start|>system\n{self.system_prompt}<|im_end|>\n<|im_start|>user\n{user_message}<|im_end|>\n<|im_start|>assistant\n{assistant_response}<|im_end|>"
                
                # 품질 메트릭 추출
                quality_metrics = item.get('quality_metrics', {})
                quality_score = quality_metrics.get('final_score', 7.0)
                is_high_quality = quality_metrics.get('is_high_quality', True)
                
                training_data.append({
                    "text": conversation,
                    "metadata": {
                        "id": item.get('id', 'Unknown'),
                        "source": source_folder,
                        "quality_score": quality_score,
                        "is_high_quality": is_high_quality,
                        "is_chunk": is_chunk,
                        "chunk_info": item.get('chunk_info', {}),
                        "dataset_type": "train" if "train_" in str(item.get('id', '')) else "val"
                    }
                })
                
                logger.info(f"변환 완료: {item.get('id', 'Unknown')} (품질: {quality_score}/10)")
                
            except Exception as e:
                logger.error(f"변환 실패 {item.get('id', 'Unknown')}: {e}")
                continue
        
        return training_data

class QwenFineTuner:
    def __init__(self, model_name: str = "Qwen/Qwen2.5-7B-Instruct"):
        self.model_name = model_name
        self.tokenizer = None
        self.model = None
        
    def setup_model_and_tokenizer(self):
        """모델과 토크나이저 설정"""
        logger.info(f"모델 로딩: {self.model_name}")
        
        # 토크나이저 로드
        self.tokenizer = AutoTokenizer.from_pretrained(
            self.model_name,
            trust_remote_code=True,
            padding_side="right"
        )
        
        # 패딩 토큰 설정
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        
        # AWQ 모델 로드 (Flash Attention 강제 비활성화)
        try:
            self.model = AutoModelForCausalLM.from_pretrained(
                self.model_name,
                torch_dtype=torch.float16,
                device_map="auto",
                trust_remote_code=True,
                attn_implementation="eager",  # Flash Attention 비활성화
                # AWQ 모델 특화 설정
                use_cache=False,
                low_cpu_mem_usage=True
            )
        except Exception as e:
            logger.error(f"AWQ 모델 로드 실패: {e}")
            logger.info("일반 모델로 재시도...")
            # AWQ 모델 실패 시 일반 모델로 대체
            self.model_name = "Qwen/Qwen2.5-7B-Instruct"
            self.model = AutoModelForCausalLM.from_pretrained(
                self.model_name,
                torch_dtype=torch.float16,
                device_map="auto",
                trust_remote_code=True,
                attn_implementation="eager",
                use_cache=False,
                low_cpu_mem_usage=True
            )
        
        logger.info("모델과 토크나이저 로딩 완료")
    
    def setup_lora_config(self) -> LoraConfig:
        """LoRA 설정"""
        return LoraConfig(
            task_type=TaskType.CAUSAL_LM,
            inference_mode=False,
            r=16,  # LoRA rank
            lora_alpha=32,  # LoRA scaling parameter
            lora_dropout=0.1,
            target_modules=["q_proj", "v_proj", "k_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
            bias="none",
        )
    
    def prepare_dataset(self, training_data: List[Dict[str, str]], max_length: int = 2048):
        """데이터셋 준비 및 토크나이징"""
        def tokenize_function(examples):
            # 텍스트 토크나이징
            tokenized = self.tokenizer(
                examples["text"],
                truncation=True,
                padding=False,
                max_length=max_length,
                return_tensors=None,
            )
            
            # labels = input_ids (자동회귀 언어 모델링)
            tokenized["labels"] = tokenized["input_ids"].copy()
            return tokenized
        
        # 고품질 데이터만 필터링 (7점 이상)
        high_quality_data = [
            item for item in training_data 
            if item["metadata"]["is_high_quality"]
        ]
        
        logger.info(f"전체 데이터: {len(training_data)}개, 고품질 데이터: {len(high_quality_data)}개")
        
        # train/val 분할 (8:2 비율로 자동 분할)
        import random
        random.shuffle(high_quality_data)
        split_idx = int(len(high_quality_data) * 0.8)
        train_data = high_quality_data[:split_idx]
        val_data = high_quality_data[split_idx:]
        
        logger.info(f"학습 데이터: {len(train_data)}개, 검증 데이터: {len(val_data)}개")
        
        if len(train_data) == 0:
            logger.error("학습 데이터가 없습니다!")
            return None, None
        
        # Dataset 객체 생성
        train_dataset = Dataset.from_list([{"text": item["text"]} for item in train_data])
        val_dataset = Dataset.from_list([{"text": item["text"]} for item in val_data]) if val_data else None
        
        # 토크나이징
        train_dataset = train_dataset.map(tokenize_function, batched=True, remove_columns=["text"])
        if val_dataset is not None:
            val_dataset = val_dataset.map(tokenize_function, batched=True, remove_columns=["text"])
        
        return train_dataset, val_dataset
    
    def train(self, train_dataset, val_dataset, output_dir: str = "./qwen3_lora_ttalkkac"):
        """LoRA 파인튜닝 실행"""
        
        # LoRA 적용
        lora_config = self.setup_lora_config()
        self.model = get_peft_model(self.model, lora_config)
        
        # 학습 가능한 파라미터 출력
        self.model.print_trainable_parameters()
        
        # 학습 인자 설정
        training_args = TrainingArguments(
            output_dir=output_dir,
            num_train_epochs=3,
            per_device_train_batch_size=1,
            per_device_eval_batch_size=1,
            gradient_accumulation_steps=8,
            warmup_steps=100,
            learning_rate=2e-4,
            fp16=True,
            logging_steps=10,
            evaluation_strategy="steps",
            eval_steps=50,
            save_steps=100,
            save_total_limit=3,
            load_best_model_at_end=True,
            metric_for_best_model="eval_loss",
            greater_is_better=False,
            dataloader_pin_memory=False,
            remove_unused_columns=False,
            gradient_checkpointing=True,
            report_to=None,  # wandb 등 비활성화
        )
        
        # 데이터 콜레이터
        data_collator = DataCollatorForSeq2Seq(
            tokenizer=self.tokenizer,
            model=self.model,
            padding=True,
            return_tensors="pt"
        )
        
        # 트레이너 설정
        trainer = Trainer(
            model=self.model,
            args=training_args,
            train_dataset=train_dataset,
            eval_dataset=val_dataset,
            data_collator=data_collator,
            tokenizer=self.tokenizer,
        )
        
        # 학습 실행
        logger.info("파인튜닝 시작...")
        train_result = trainer.train()
        
        # 모델 저장
        trainer.save_model()
        trainer.save_state()
        
        # 학습 결과 저장
        with open(os.path.join(output_dir, "training_results.json"), "w") as f:
            json.dump({
                "train_runtime": train_result.metrics["train_runtime"],
                "train_samples_per_second": train_result.metrics["train_samples_per_second"],
                "train_steps_per_second": train_result.metrics["train_steps_per_second"],
                "total_flos": train_result.metrics["total_flos"],
                "train_loss": train_result.metrics["train_loss"],
            }, f, indent=2)
        
        logger.info(f"파인튜닝 완료! 모델 저장 경로: {output_dir}")
        return trainer

def main():
    print("=" * 60)
    print("🚀 Ttalkkac Qwen3 LoRA 파인튜닝 시작")
    print("=" * 60)
    
    # 1. 데이터 변환
    print("\n📊 1. 골드 스탠다드 데이터 로드 및 변환")
    converter = TtalkkacDatasetConverter()
    
    results_dir = "ttalkkac_gold_standard_results_20250731_104912"
    gold_data = converter.load_gold_standard_data(results_dir)
    
    if not gold_data:
        print("❌ 골드 스탠다드 데이터를 찾을 수 없습니다.")
        return
    
    print(f"✅ 골드 스탠다드 데이터 로드 완료: {len(gold_data)}개")
    
    # 실제 프로젝트 형식으로 변환
    training_data = converter.convert_to_training_format(gold_data)
    
    if not training_data:
        print("❌ 변환된 학습 데이터가 없습니다.")
        return
    
    print(f"✅ 학습 데이터 변환 완료: {len(training_data)}개")
    
    # 2. 파인튜닝 설정 및 실행
    print("\n🤖 2. Qwen3 모델 설정 및 LoRA 파인튜닝")
    
    # GPU 확인
    if torch.cuda.is_available():
        print(f"✅ GPU 사용 가능: {torch.cuda.get_device_name()}")
        print(f"   VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f}GB")
    else:
        print("⚠️ CPU 모드로 실행됩니다.")
    
    # 파인튜너 초기화 (AWQ 모델 우선 시도)
    finetuner = QwenFineTuner("Qwen/Qwen3-14B-AWQ")
    finetuner.data_converter = converter
    
    # 모델과 토크나이저 설정
    finetuner.setup_model_and_tokenizer()
    
    # 데이터셋 준비
    train_dataset, val_dataset = finetuner.prepare_dataset(training_data, max_length=2048)
    
    if train_dataset is None:
        print("❌ 학습 데이터셋 준비 실패")
        return
    
    # 파인튜닝 실행
    output_dir = f"./qwen3_lora_ttalkkac_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    trainer = finetuner.train(train_dataset, val_dataset, output_dir)
    
    print("\n🎉 파인튜닝 완료!")
    print(f"📁 모델 저장 경로: {output_dir}")
    print("\n💡 모델 사용 방법:")
    print("1. LoRA 어댑터가 저장되었습니다.")
    print("2. 추론 시에는 베이스 모델 + LoRA 어댑터를 함께 로드하세요.")
    print("3. 실제 프로젝트에서 사용하는 프롬프트 형식을 그대로 사용하세요.")

if __name__ == "__main__":
    main()