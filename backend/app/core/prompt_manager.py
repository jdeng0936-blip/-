import yaml
import os
from functools import lru_cache

class PromptManager:
    """ Prompt 进化核心管理器：统一从外部 YAML 加载 Prompt，支持未来多版本 A/B 测试 """

    def __init__(self, registry_path: str = None):
        if not registry_path:
            # 默认同 llm_registry.yaml 所在的 backend 根目录
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            self.registry_path = os.path.join(base_dir, "prompts_registry.yaml")
        else:
            self.registry_path = registry_path
        
        self.prompts_cache = {}
        self._load_registry()

    def _load_registry(self):
        """加载 prompt 注册表"""
        if not os.path.exists(self.registry_path):
            print(f"⚠️ Prompt 注册表 {self.registry_path} 不存在，将使用降级空配置")
            return
            
        with open(self.registry_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
            self.prompts_cache = data.get("prompts", {})

    def get_prompt(self, category: str, version_key: str = None) -> str:
        """
        获取指定类别下的 prompt 模板
        category: 如 doc_generation, critic_evaluation, consistency_scan
        version_key: 具体版本（如 v2_few_shot）。如果不传，默认取第一个定义的版本。
        """
        cat_data = self.prompts_cache.get(category, {})
        if not cat_data:
            raise ValueError(f"Prompt category '{category}' not found in registry.")

        if version_key:
            prompt_data = cat_data.get(version_key)
            if not prompt_data:
                raise ValueError(f"Prompt version '{version_key}' not found in category '{category}'.")
        else:
            # 默认取字典的第一个 key 的内容
            first_key = list(cat_data.keys())[0]
            prompt_data = cat_data[first_key]

        return prompt_data.get("template", "")

    def format_prompt(self, category: str, version_key: str = None, **kwargs) -> str:
        """
        获取并直接格式化 Prompt
        """
        template = self.get_prompt(category, version_key)
        # 用 kwargs 安全地 format，避免缺少参数报错
        try:
            return template.format(**kwargs)
        except KeyError as e:
            print(f"⚠️ Prompt 格式化缺少参数: {e}")
            # fallback: 保留未传入的变量
            class SafeDict(dict):
                def __missing__(self, key):
                    return '{' + key + '}'
            return template.format_map(SafeDict(**kwargs))

# 暴露一个单例全局实例
prompt_manager = PromptManager()
