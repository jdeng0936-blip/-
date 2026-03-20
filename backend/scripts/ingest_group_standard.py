"""
集团规范结构化入库脚本 — 将《采掘运技术管理规定》按条文切分后写入标准库

用法: python scripts/ingest_group_standard.py

功能:
  1. 读取已提取的全文文本 (/tmp/caijueyun_full.txt)
  2. 按"第X篇/第X章/第X节/第X条"层级切分为结构化条款
  3. 写入 std_document + std_clause 表
  4. 标记 doc_type = '集团标准'，便于 RAG 检索时加权
"""
import asyncio
import os
import re
import sys

# 让脚本能 import app 包
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))


# ========== 中文数字映射 ==========
CN_NUMS = {
    "一": 1, "二": 2, "三": 3, "四": 4, "五": 5,
    "六": 6, "七": 7, "八": 8, "九": 9, "十": 10,
    "十一": 11, "十二": 12, "十三": 13, "十四": 14, "十五": 15,
    "十六": 16, "十七": 17, "十八": 18, "十九": 19, "二十": 20,
    "二十一": 21, "二十二": 22, "二十三": 23, "二十四": 24, "二十五": 25,
    "二十六": 26, "二十七": 27, "二十八": 28, "二十九": 29, "三十": 30,
    "三十一": 31, "三十二": 32, "三十三": 33, "三十四": 34, "三十五": 35,
    "三十六": 36, "三十七": 37, "三十八": 38, "三十九": 39, "四十": 40,
    "四十一": 41, "四十二": 42, "四十三": 43, "四十四": 44, "四十五": 45,
    "五十": 50, "六十": 60, "七十": 70, "八十": 80, "九十": 90,
    "一百": 100,
}


def cn_to_num(cn: str) -> int:
    """简易中文数字→阿拉伯数字"""
    if cn in CN_NUMS:
        return CN_NUMS[cn]
    return 0


# ========== 层级识别正则 ==========
# 匹配: 第X篇, 第X章, 第X节, 第X条
RE_PIAN = re.compile(r'^第([一二三四五六七八九十百]+)篇\s*(.*)')
RE_ZHANG = re.compile(r'^第([一二三四五六七八九十百]+)章\s*(.*)')
RE_JIE = re.compile(r'^第([一二三四五六七八九十百]+)节\s*(.*)')
RE_TIAO = re.compile(r'^第([一二三四五六七八九十百]+)条\s*(.*)')

# 适配 PDF 提取的异体字（⽤→用, ⼯→工 等）
RE_PIAN_ALT = re.compile(r'^第([一二三四五六七八九十百]+)篇\s*(.*)')
RE_ZHANG_ALT = re.compile(r'^第([一二三四五六七八九十百]+)章\s*(.*)')


def classify_line(line: str):
    """
    判断一行文本属于哪个层级

    返回: (level_type, cn_number, title_rest) 或 None
    level_type: 'pian' | 'zhang' | 'jie' | 'tiao'
    """
    line = line.strip()
    # 清洗 PDF 异体字
    line_clean = line.replace('⽤', '用').replace('⼯', '工').replace('⾯', '面') \
                     .replace('⻓', '长').replace('⼈', '人').replace('⽣', '生') \
                     .replace('⻛', '风').replace('⽀', '支').replace('⽔', '水') \
                     .replace('⾏', '行').replace('⼤', '大').replace('⼩', '小') \
                     .replace('⾼', '高').replace('⽅', '方').replace('⽆', '无') \
                     .replace('⼀', '一').replace('⼆', '二').replace('⼏', '几') \
                     .replace('⽬', '目').replace('⽊', '木').replace('⽕', '火') \
                     .replace('⽯', '石').replace('⾦', '金').replace('⻋', '车') \
                     .replace('⻔', '门').replace('⻩', '黄').replace('⿊', '黑')

    for regex, lvl in [(RE_PIAN, 'pian'), (RE_ZHANG, 'zhang'),
                        (RE_JIE, 'jie'), (RE_TIAO, 'tiao')]:
        m = regex.match(line_clean)
        if m:
            cn = m.group(1)
            rest = m.group(2).strip()
            return (lvl, cn, rest)
    return None


def parse_document(text: str) -> list[dict]:
    """
    将全文解析为结构化条款列表

    返回: [{clause_no, title, content, level, pian, zhang, jie}]
    """
    lines = text.splitlines()
    clauses = []

    # 当前上下文
    cur_pian = ""
    cur_zhang = ""
    cur_jie = ""
    cur_clause = None

    def sanitize_text(s: str) -> str:
        """清洗文本：移除 0x00 空字节、控制字符和 PDF 页码标记"""
        s = s.replace('\x00', '')  # PostgreSQL 不接受 NULL 字节
        s = re.sub(r'[\x01-\x08\x0b\x0c\x0e-\x1f]', '', s)  # 移除控制字符
        s = re.sub(r'—\d+—', '', s)  # 删除 —6— 等页码标记
        s = re.sub(r'=== 第\d+页 ===', '', s)  # 删除页码标记
        return s.strip()

    def flush_clause():
        nonlocal cur_clause
        if cur_clause and cur_clause["content"].strip():
            cur_clause["content"] = sanitize_text(cur_clause["content"])
            cur_clause["title"] = sanitize_text(cur_clause.get("title", ""))
            if len(cur_clause["content"]) > 10:  # 过滤过短的碎片
                clauses.append(cur_clause)
        cur_clause = None

    for line in lines:
        line = line.strip()
        if not line:
            continue
        # 跳过页码标记
        if re.match(r'^=== 第\d+页 ===$', line):
            continue

        info = classify_line(line)
        if info:
            lvl_type, cn, rest = info
            if lvl_type == 'pian':
                flush_clause()
                cur_pian = f"第{cn}篇 {rest}"
                cur_zhang = ""
                cur_jie = ""
            elif lvl_type == 'zhang':
                flush_clause()
                cur_zhang = f"第{cn}章 {rest}"
                cur_jie = ""
            elif lvl_type == 'jie':
                flush_clause()
                cur_jie = f"第{cn}节 {rest}"
            elif lvl_type == 'tiao':
                flush_clause()
                clause_no = f"{cn_to_num(cn)}"
                # 确定层级深度
                level = 0
                if cur_pian:
                    level += 1
                if cur_zhang:
                    level += 1
                if cur_jie:
                    level += 1

                # 构建标题前缀
                prefix_parts = []
                if cur_pian:
                    prefix_parts.append(cur_pian)
                if cur_zhang:
                    prefix_parts.append(cur_zhang)
                if cur_jie:
                    prefix_parts.append(cur_jie)

                cur_clause = {
                    "clause_no": f"第{cn}条",
                    "title": " > ".join(prefix_parts) if prefix_parts else "",
                    "content": rest + "\n" if rest else "",
                    "level": level,
                    "hierarchy": " > ".join(prefix_parts),
                }
        else:
            # 普通正文行，追加到当前条款
            if cur_clause:
                cur_clause["content"] += line + "\n"
            else:
                # 无归属的文本（如开头部分），创建一个概述条款
                if len(line) > 15 and any(
                    kw in line for kw in ["必须", "应当", "不得", "严禁", "规定"]
                ):
                    cur_clause = {
                        "clause_no": "",
                        "title": " > ".join(
                            p for p in [cur_pian, cur_zhang, cur_jie] if p
                        ),
                        "content": line + "\n",
                        "level": sum(1 for p in [cur_pian, cur_zhang, cur_jie] if p),
                        "hierarchy": " > ".join(
                            p for p in [cur_pian, cur_zhang, cur_jie] if p
                        ),
                    }

    flush_clause()
    return clauses


async def main():
    from sqlalchemy import text
    from app.core.database import engine

    # 读取全文
    txt_path = "/tmp/caijueyun_full.txt"
    if not os.path.exists(txt_path):
        print(f"❌ 文件不存在: {txt_path}")
        print("  请先运行 PDF 提取步骤生成此文件")
        sys.exit(1)

    with open(txt_path, "r", encoding="utf-8") as f:
        full_text = f.read()

    print(f"📄 全文长度: {len(full_text)} 字符")

    # 解析条款
    clauses = parse_document(full_text)
    print(f"📊 解析出条款: {len(clauses)} 条")

    if not clauses:
        print("❌ 未解析到任何条款，请检查文本格式")
        sys.exit(1)

    # 打印前10条预览
    for i, c in enumerate(clauses[:10]):
        print(f"  [{i+1}] {c['clause_no']} | {c['title'][:40]} | {c['content'][:60].strip()}")

    # 写入数据库
    async with engine.begin() as conn:
        # 检查是否已录入
        existing = (await conn.execute(text(
            "SELECT id FROM std_document WHERE title = :title"
        ), {"title": "采掘运技术管理规定"})).fetchone()

        if existing:
            doc_id = existing[0]
            # 删除旧条款重新录入
            del_count = (await conn.execute(text(
                "DELETE FROM std_clause WHERE document_id = :did"
            ), {"did": doc_id})).rowcount
            print(f"🔄 已删除旧条款 {del_count} 条，重新录入...")
        else:
            # 创建文档记录
            result = await conn.execute(text(
                "INSERT INTO std_document (title, doc_type, version, is_current, tenant_id) "
                "VALUES (:title, :doc_type, :version, :is_current, :tenant_id) RETURNING id"
            ), {
                "title": "采掘运技术管理规定",
                "doc_type": "集团标准",
                "version": "2026修订版",
                "is_current": True,
                "tenant_id": 0,
            })
            doc_id = result.fetchone()[0]
            print(f"✅ 创建文档记录: id={doc_id}")

        # 批量插入条款
        inserted = 0
        for c in clauses:
            await conn.execute(text(
                "INSERT INTO std_clause (document_id, clause_no, title, content, level) "
                "VALUES (:doc_id, :clause_no, :title, :content, :level)"
            ), {
                "doc_id": doc_id,
                "clause_no": c["clause_no"],
                "title": c["title"],
                "content": c["content"],
                "level": c["level"],
            })
            inserted += 1

        print(f"\n🎉 入库完成: {inserted} 条集团规范条款")
        print(f"   文档ID: {doc_id}")
        print(f"   doc_type: 集团标准")
        print(f"\n⏭️  下一步: python scripts/vectorize_clauses.py 完成向量化")


if __name__ == "__main__":
    asyncio.run(main())
