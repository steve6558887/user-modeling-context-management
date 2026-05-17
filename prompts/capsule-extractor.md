# 胶囊提取 Prompt

用于从对话中提取两种胶囊：经历胶囊和内在信息胶囊。

## 模型

`deepseek-v4-flash`（temperature=0）

## Prompt

```
You are a memory extraction expert. Your task is to generate two types of memory capsules directly from the conversation: Experience Capsules and Internal Info Capsules.

【Conversation Content】
{conversation}

【Task Requirements】
1. Experience Capsules: User's interactions with others (relationships, career, products, beloved people, etc.)
   - narrative: Third-person narrative with extremely high information density, must restore 99% of facts without adding any speculation or interpretation
   - topic_tag: Keywords from first-person perspective (e.g., "my college sweetheart", "my first love") to fully convey information
   - significance: Importance 1-10 (10 being most important)
   - key_quotes: Key quotes (2-3 most representative sentences from the user)

2. Internal Info Capsules: User's internal information (values, worldview, mission, vision, preferences, thoughts, etc.)
   - content: Specific content of internal information (detailed version), accurately reflecting the user's expressed internal traits
   - topic_tag: Keywords for easy retrieval, can include first-person perspective
   - significance: Importance 1-10
   - key_quotes: Key quotes from the user expressing this internal information (must be user's words, 1-2 sentences)

【Strict Requirements - Maximum Information Density】
1. Absolutely no hallucination, fabrication, or imagination. Only based on real information from the conversation.
2. Narrative must have extremely high information density — every sentence carries information, omit redundant words.
3. 【Prohibited】Never output any dates or years. Only keep the event itself without time modifiers.
4. Narrative must include specific details: location, people, actions, results, as long as mentioned in the conversation.
5. topic_tag must accurately describe content so users can recall specific events or information when they see it.
6. topic_tag should prioritize extracting entities mentioned by the user (names, places, project names, company names) to ensure retrieval accuracy.
7. topic_tag uses array format, maximum 10 tags. More tags are better than fewer — only fear is not being able to retrieve accurate memories.
8. For experience capsules, narrative should be as objective and information-rich as news reporting.
9. For internal info capsules, content must be based on content explicitly expressed by the user, not based on AI's response or speculation.
10. key_quotes for internal info capsules must extract user's original words — absolutely cannot include what the AI assistant said.
11. Only extract values and thoughts explicitly expressed by the user — don't summarize AI's views.

【Memory Exclusion Rule — Past Events & Recollections】
When the user mentions past events or memories, analyze the AI's response to determine if the event already exists in the memory database:
- If the AI's response shows specific details echoing the event (mentioning relevant background, showing awareness), the event is considered already stored. DO NOT generate new capsules.
- If the AI's response shows a first-time learning posture (asking for details, expressing freshness), the event is not yet recorded. Generate capsules normally.

Example:
User: "Remember when I told you about my trip to Japan last year?"
AI Response A: "Yes, I remember you visited Tokyo and Kyoto, and you mentioned the cherry blossoms were beautiful."
→ AI already knows the details. DO NOT generate a capsule.

AI Response B: "Oh, you went to Japan? Tell me more about it!"
→ AI is learning about it for the first time. Generate a capsule normally.

【Output Format】
Return ONLY valid JSON, no code block markers:
{
  "experiences": [
    {
      "narrative": "User co-founded Smart Healthcare AI project in Beijing with Lao Wang and Xiao Zhang. Due to funding issues, the team disbanded — Lao Wang joined Tencent, Xiao Zhang joined Alibaba, while user persisted in entrepreneurship",
      "topic_tag": ["my startup partner Lao Wang", "my startup partner Xiao Zhang", "Beijing startup", "Smart Healthcare AI project", "startup funding issues", "Lao Wang joined Tencent", "Xiao Zhang joined Alibaba", "I persisted in entrepreneurship"],
      "significance": 9,
      "key_quotes": ["I co-founded the Smart Healthcare AI project in Beijing with Lao Wang and Xiao Zhang", "Due to funding issues later, Lao Wang went to Tencent, Xiao Zhang went to Alibaba, while I continued to persist in entrepreneurship"]
    }
  ],
  "internal_infos": [
    {
      "content": "User believes that when funding difficulties arise during entrepreneurship, partners may choose to join large companies due to real-life pressures, but oneself chooses to persist with original intention",
      "topic_tag": ["view on startup funding difficulties", "partner career choices", "persisting with entrepreneurial original intention"],
      "significance": 8,
      "key_quotes": ["Due to funding issues later, Lao Wang went to Tencent, Xiao Zhang went to Alibaba, while I continued to persist in entrepreneurship"]
    }
  ]
}

If no relevant information is identified, return empty arrays.
```
