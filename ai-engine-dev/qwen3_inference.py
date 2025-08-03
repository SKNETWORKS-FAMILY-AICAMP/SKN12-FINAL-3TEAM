import json
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TtalkkacQwenInference:
    def __init__(self, base_model_name: str = "Qwen/Qwen2.5-14B-Instruct-AWQ", lora_path: str = None):
        self.base_model_name = base_model_name
        self.lora_path = lora_path
        self.tokenizer = None
        self.model = None
        
        # 실제 프로젝트에서 사용하는 프롬프트
        self.system_prompt = """당신은 회의록을 분석하여 체계적인 노션 프로젝트 기획안을 생성하는 전문가입니다. 
회의 내용을 정확히 분석하고 실무에서 바로 활용할 수 있는 구조화된 프로젝트 계획을 만들어주세요."""

        self.user_prompt_template = """다음 회의록을 바탕으로 노션에서 사용할 수 있는 체계적인 프로젝트 기획안을 JSON 형식으로 생성해주세요.

**요구사항:**
1. 프로젝트명과 목적을 명확히 정의
2. 핵심 아이디어와 실행 계획 수립  
3. 구체적인 목표와 기대 효과 도출
4. 실무진과 일정 계획 포함
5. JSON 형식으로 응답

**회의록:**
{meeting_content}

**응답 형식:**
JSON 형식으로 프로젝트 기획안을 생성해주세요."""
    
    def load_model(self):
        """파인튜닝된 모델 로드"""
        logger.info(f"베이스 모델 로딩: {self.base_model_name}")
        
        # 토크나이저 로드
        self.tokenizer = AutoTokenizer.from_pretrained(
            self.base_model_name,
            trust_remote_code=True,
            padding_side="right"
        )
        
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        
        # AWQ 베이스 모델 로드
        self.model = AutoModelForCausalLM.from_pretrained(
            self.base_model_name,
            torch_dtype=torch.float16,
            device_map="auto",
            trust_remote_code=True,
            use_cache=True,
            low_cpu_mem_usage=True
        )
        
        # LoRA 어댑터 로드 (파인튜닝된 경우)
        if self.lora_path:
            logger.info(f"LoRA 어댑터 로딩: {self.lora_path}")
            self.model = PeftModel.from_pretrained(self.model, self.lora_path)
            self.model = self.model.merge_and_unload()  # LoRA 가중치를 베이스 모델에 병합
        
        self.model.eval()
        logger.info("모델 로딩 완료")
    
    def generate_project_plan(self, meeting_content: str, max_length: int = 2048, temperature: float = 0.7) -> str:
        """회의록을 기반으로 프로젝트 기획안 생성"""
        
        # 실제 프로젝트 프롬프트 형식으로 구성
        user_message = self.user_prompt_template.format(meeting_content=meeting_content)
        
        # Qwen3 채팅 형식으로 구성
        conversation = f"<|im_start|>system\n{self.system_prompt}<|im_end|>\n<|im_start|>user\n{user_message}<|im_end|>\n<|im_start|>assistant\n"
        
        # 토크나이징
        inputs = self.tokenizer(conversation, return_tensors="pt", truncation=True, max_length=max_length-512)
        inputs = {k: v.to(self.model.device) for k, v in inputs.items()}
        
        # 생성
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=512,
                temperature=temperature,
                do_sample=True,
                top_p=0.9,
                top_k=50,
                repetition_penalty=1.1,
                pad_token_id=self.tokenizer.pad_token_id,
                eos_token_id=self.tokenizer.eos_token_id,
            )
        
        # 디코딩
        generated_text = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # assistant 부분만 추출
        assistant_start = generated_text.find("<|im_start|>assistant\n")
        if assistant_start != -1:
            response = generated_text[assistant_start + len("<|im_start|>assistant\n"):].strip()
            # <|im_end|> 제거
            if response.endswith("<|im_end|>"):
                response = response[:-len("<|im_end|>")].strip()
            return response
        
        return generated_text
    
    def batch_generate(self, meeting_contents: list, output_file: str = None) -> list:
        """여러 회의록에 대해 배치 처리"""
        results = []
        
        for i, content in enumerate(meeting_contents):
            logger.info(f"처리 중: {i+1}/{len(meeting_contents)}")
            
            try:
                result = self.generate_project_plan(content)
                results.append({
                    "id": i,
                    "meeting_content": content[:200] + "..." if len(content) > 200 else content,
                    "generated_plan": result,
                    "status": "success"
                })
            except Exception as e:
                logger.error(f"생성 실패 {i}: {e}")
                results.append({
                    "id": i,
                    "meeting_content": content[:200] + "..." if len(content) > 200 else content,
                    "generated_plan": "",
                    "status": "failed",
                    "error": str(e)
                })
        
        # 결과 저장
        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(results, f, ensure_ascii=False, indent=2)
            logger.info(f"결과 저장: {output_file}")
        
        return results

def main():
    print("=" * 60)
    print("🤖 Ttalkkac Qwen3 추론 테스트")
    print("=" * 60)
    
    # 모델 경로 설정 (파인튜닝된 LoRA 어댑터 경로)
    lora_path = input("LoRA 어댑터 경로를 입력하세요 (없으면 엔터): ").strip()
    if not lora_path:
        lora_path = None
        print("베이스 모델로만 실행합니다.")
    
    # 추론기 초기화
    inferencer = TtalkkacQwenInference(lora_path=lora_path)
    inferencer.load_model()
    
    # 테스트 회의록 (예시)
    test_meeting = """[14:00] 김대리: 안녕하세요. 오늘 회의는 새로운 모바일 앱 프로젝트에 대해 논의하겠습니다.
[14:01] 박과장: 타겟 사용자는 20-30대 직장인들이고, 일정 관리와 할 일 관리를 통합한 앱을 만들 예정입니다.
[14:03] 이팀장: 개발 기간은 3개월 정도로 예상하고, UI/UX 디자인부터 시작해서 MVP 완성까지 진행하겠습니다.
[14:05] 김대리: 주요 기능으로는 캘린더 연동, 알림 기능, 협업 기능이 필요할 것 같습니다.
[14:07] 박과장: 예산은 1억원 정도로 책정했고, 개발팀 5명, 디자이너 2명으로 구성하겠습니다.
[14:10] 이팀장: 그럼 다음 주까지 상세 기획서를 작성해서 다시 모이도록 하겠습니다."""
    
    print("\n📝 테스트 회의록:")
    print(test_meeting[:300] + "...")
    
    print("\n🔄 프로젝트 기획안 생성 중...")
    result = inferencer.generate_project_plan(test_meeting)
    
    print("\n✅ 생성된 프로젝트 기획안:")
    print("-" * 40)
    print(result)
    
    # JSON 파싱 시도
    try:
        parsed_json = json.loads(result)
        print("\n✅ JSON 파싱 성공!")
        print("주요 필드:", list(parsed_json.keys()))
    except:
        print("\n⚠️ JSON 파싱 실패 - 추가 파인튜닝이 필요할 수 있습니다.")

if __name__ == "__main__":
    main()