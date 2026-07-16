#!/usr/bin/env python3
"""Build the large cross-world creature library for 黑曜纪元.

The generator is deterministic and intentionally data-driven: rerunning it
refreshes generated seed tables, the first 1000 image-ready dossiers, and the
batch indexes without touching hand-written creature files.
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OVERVIEW_DIR = ROOT / "00_总览"
CREATURE_DIR = ROOT / "04_生物单位"

GENERATOR_SOURCE = "biolibrary-generator-v1"

SEED_TABLE = OVERVIEW_DIR / "9999生物种子总表.md"
CLEAN_TABLE = OVERVIEW_DIR / "9999生物种子清洗表.md"
CANDIDATE_TABLE = OVERVIEW_DIR / "第1批1000生物候选名单.md"
BATCH_INDEX = OVERVIEW_DIR / "首批1000可生图生物索引.md"


RACES = [
    {
        "name": "云脑族",
        "system": "高科技与轨道文明",
        "prefixes": ["云墓", "脑晶", "冷却雾", "人格", "缓存", "服务器"],
        "interfaces": ["缓存虫", "人格备份幽灵", "服务器清道生物", "云端脑兽"],
        "materials": ["脑晶碎片", "冷却雾囊", "人格残片"],
        "locations": ["云端墓园", "废弃数据塔", "服务器低温海"],
        "visuals": ["透明电子", "诡异", "可爱"],
        "style": "HUB全息冷白",
    },
    {
        "name": "墓歌族",
        "system": "诡秘、月光、镜像与身份",
        "prefixes": ["墓歌", "亡名", "祖灵", "黑礼", "碑苔", "葬声"],
        "interfaces": ["亡名鸟", "墓碑苔兽", "葬歌虫", "祖灵寄声兽"],
        "materials": ["亡名骨牌", "墓歌回声", "碑苔灰"],
        "locations": ["祖坟", "黑礼堂", "墓园合唱坑"],
        "visuals": ["古典", "神圣", "阴郁"],
        "style": "暗金书卷档案",
    },
    {
        "name": "无面盐徒",
        "system": "克苏鲁、星外与深海梦境",
        "prefixes": ["盐壳", "失名", "无面", "盐雾", "白盐", "面皮"],
        "interfaces": ["盐壳虫", "失名犬", "盐雾漂虱", "面孔吞食幼体"],
        "materials": ["盐壳", "无名面皮", "盐雾结晶"],
        "locations": ["沙漠旧城", "盐雾驿站", "失名城门"],
        "visuals": ["恶心", "诡异", "中庸"],
        "style": "HUB全息冷白",
    },
    {
        "name": "星序族",
        "system": "高科技与轨道文明",
        "prefixes": ["星序", "轨道", "星历", "信标", "预言", "冷白"],
        "interfaces": ["轨道信标兽", "量子占卜鸟", "星历维护虫", "裁决使魔"],
        "materials": ["星历芯片", "轨道冷羽", "预言碎码"],
        "locations": ["轨道城", "预言服务器", "冷白星桥"],
        "visuals": ["炫酷", "神圣", "机械"],
        "style": "HUB全息冷白",
    },
    {
        "name": "星瘤裔",
        "system": "克苏鲁、星外与深海梦境",
        "prefixes": ["星瘤", "重力", "黑陨", "心灵", "非欧", "坠星"],
        "interfaces": ["星瘤寄生虫", "重力肉芽", "陨铁幼兽", "心灵低语菌"],
        "materials": ["星瘤肉", "黑陨铁", "重力腺"],
        "locations": ["低轨坠落点", "非欧洞窟", "坠星坑"],
        "visuals": ["恶心", "星外", "诡异"],
        "style": "黑底涂鸦档案",
    },
    {
        "name": "星遗族",
        "system": "克苏鲁、星外与深海梦境",
        "prefixes": ["星遗", "陨星", "几何", "折角", "裂隙", "星尘"],
        "interfaces": ["陨星尘蛹", "折角蜥", "星尘回声虫", "几何影兽"],
        "materials": ["陨星粉", "几何骨片", "裂隙尘"],
        "locations": ["坠星谷", "空间裂缝", "非三维空间"],
        "visuals": ["诡异", "炫酷", "星外"],
        "style": "HUB全息冷白",
    },
    {
        "name": "梦蛹族",
        "system": "克苏鲁、星外与深海梦境",
        "prefixes": ["梦蛹", "传说", "睡眠", "童话", "梦壳", "眠室"],
        "interfaces": ["梦蛹寄生虫", "传说食蚕", "睡眠孢兽", "梦壳幼体"],
        "materials": ["梦蛹壳", "传说碎片", "睡眠孢粉"],
        "locations": ["眠室", "童话病院", "集体梦池"],
        "visuals": ["可爱", "诡异", "恶心"],
        "style": "宣纸水墨",
    },
    {
        "name": "棱光裔",
        "system": "高科技与轨道文明",
        "prefixes": ["棱光", "光谱", "全息", "折光", "彩虹", "镜棱"],
        "interfaces": ["光谱鱼", "全息鹿", "折光尘虫", "彩虹警戒兽"],
        "materials": ["棱镜鳞", "光谱晶", "全息膜"],
        "locations": ["全息剧场", "折光塔", "棱镜水域"],
        "visuals": ["炫酷", "可爱", "神圣"],
        "style": "HUB全息冷白",
    },
    {
        "name": "油血族",
        "system": "赛博工业与城市废土",
        "prefixes": ["油血", "燃油", "炉心", "活燃", "火花", "炼油"],
        "interfaces": ["油血跳虫", "燃油犬", "活体燃料蠕虫", "火花寄生物"],
        "materials": ["油血", "燃料腺", "炉渣牙"],
        "locations": ["炼油贫民区", "移动炉车", "燃料管廊"],
        "visuals": ["恶心", "炫酷", "工业"],
        "style": "锈黑工业档案",
    },
    {
        "name": "渊眠族",
        "system": "克苏鲁、星外与深海梦境",
        "prefixes": ["渊眠", "深眠", "梦潮", "古神", "黑水", "海沟"],
        "interfaces": ["深眠水母", "梦潮螺", "古神梦鳃", "黑水幼兽"],
        "materials": ["黑水梦液", "深海睡壳", "梦鳃膜"],
        "locations": ["海沟", "沉眠祭坛", "黑水梦湾"],
        "visuals": ["深海", "诡异", "神圣"],
        "style": "HUB全息冷白",
    },
    {
        "name": "潮裔",
        "system": "海洋、深海、蛇环与潮汐血脉",
        "prefixes": ["潮汐", "盐潮", "海血", "契约贝", "溺湾", "蛇环"],
        "interfaces": ["潮汐蛇", "盐潮信使", "海血蟹", "契约贝兽"],
        "materials": ["潮血", "契约贝壳", "海蛇鳞"],
        "locations": ["港湾", "潮汐神庙", "蛇环海渠"],
        "visuals": ["中庸", "炫酷", "深海"],
        "style": "HUB全息冷白",
    },
    {
        "name": "灰民",
        "system": "地点生态、自然异化与灾后生态",
        "prefixes": ["灰烬", "灾后", "余烬", "灰皮", "废墟", "神灾"],
        "interfaces": ["灰烬幼兽", "灾后拾荒鸟", "余烬鼠", "灰皮清道虫"],
        "materials": ["灰骨", "余烬粉", "灾灰乳"],
        "locations": ["废墟营地", "灾后城市", "灰烬避难所"],
        "visuals": ["中庸", "悲悯", "腐生"],
        "style": "黑底涂鸦档案",
    },
    {
        "name": "烟骨巨民",
        "system": "赛博工业与城市废土",
        "prefixes": ["烟骨", "炉烟", "骨煤", "烟囱", "重载", "炉灰"],
        "interfaces": ["炉烟兽", "骨煤虫", "烟囱巨犬", "重载灰蜥"],
        "materials": ["烟骨", "炉灰髓", "煤骨片"],
        "locations": ["重工业厂区", "巨型烟囱", "搬炉栈道"],
        "visuals": ["炫酷", "机械", "恶心"],
        "style": "锈黑工业档案",
    },
    {
        "name": "狼灾血裔",
        "system": "北欧原始血裔与霜巨生态",
        "prefixes": ["狼灾", "饥月", "诅咒", "兽牙", "血嗅", "末日"],
        "interfaces": ["饥月狼", "诅咒吞食虫", "兽牙幼体", "血嗅猎犬"],
        "materials": ["狼灾血", "兽骨", "吞光胃石"],
        "locations": ["北境荒原", "月蚀战场", "末日雪原"],
        "visuals": ["炫酷", "野性", "恶心"],
        "style": "黑底涂鸦档案",
    },
    {
        "name": "电瘾族",
        "system": "赛博工业与城市废土",
        "prefixes": ["电瘾", "神经", "接口", "数据", "成瘾", "屏光"],
        "interfaces": ["神经跳蚤", "接口水母", "电瘾寄生虫", "数据啮鼠"],
        "materials": ["神经线", "成瘾芯片", "接口胶"],
        "locations": ["贫民机房", "数据巷", "戒断诊所"],
        "visuals": ["赛博", "可爱", "恶心"],
        "style": "锈黑工业档案",
    },
    {
        "name": "白械天使",
        "system": "高科技与轨道文明",
        "prefixes": ["白械", "净翼", "审判", "陶瓷", "光环", "圣骸"],
        "interfaces": ["净翼幼机", "审判鸽", "陶瓷猎犬", "光环寄生物"],
        "materials": ["陶瓷羽", "神经光环", "净盐粉"],
        "locations": ["审判站", "轨道教堂", "难民净化廊"],
        "visuals": ["神圣", "炫酷", "诡异"],
        "style": "银白审判档案",
    },
    {
        "name": "瞳民",
        "system": "诡秘、月光、镜像与身份",
        "prefixes": ["瞳民", "预言", "真相", "目击", "视线", "万眼"],
        "interfaces": ["预言眼虫", "真相蝠", "目击鹿", "视线寄生物"],
        "materials": ["眼晶", "预言泪", "视线膜"],
        "locations": ["观测塔", "审讯室", "证词剧场"],
        "visuals": ["诡异", "中庸", "神圣"],
        "style": "宣纸水墨",
    },
    {
        "name": "管巢族",
        "system": "赛博工业与城市废土",
        "prefixes": ["管巢", "管道", "缆皮", "回声", "暗渠", "旧电缆"],
        "interfaces": ["管道蜗", "缆皮鼠", "回声螺", "暗渠灯虫"],
        "materials": ["管壁黏液", "旧电缆", "回声壳"],
        "locations": ["城市管道", "废弃地铁", "地下走私线"],
        "visuals": ["中庸", "可爱", "工业"],
        "style": "锈黑工业档案",
    },
    {
        "name": "缄口族",
        "system": "诡秘、月光、镜像与身份",
        "prefixes": ["缄口", "无口", "秘密", "封言", "吞声", "沉默"],
        "interfaces": ["无口梦虫", "秘密蛭", "封言鸟", "吞声幼兽"],
        "materials": ["封口膜", "梦语结晶", "沉默舌骨"],
        "locations": ["密室", "沉默剧院", "禁语档案室"],
        "visuals": ["诡异", "可爱", "古典"],
        "style": "暗金书卷档案",
    },
    {
        "name": "肉件族",
        "system": "赛博工业与城市废土",
        "prefixes": ["肉件", "活体接口", "器官仓", "二手腺", "缝合", "记忆腺"],
        "interfaces": ["活体接口虫", "器官仓兽", "二手腺体鼠", "缝合工具兽"],
        "materials": ["活体义体", "记忆腺", "接口肉膜"],
        "locations": ["黑诊所", "贫民义体市场", "器官租赁仓"],
        "visuals": ["恶心", "炫酷", "机械血肉"],
        "style": "锈黑工业档案",
    },
    {
        "name": "肉圣族",
        "system": "西方魔法、贵族与学院",
        "prefixes": ["肉圣", "肉芽", "器官花", "膜翼", "进化腺", "圣肉"],
        "interfaces": ["肉芽圣虫", "器官花", "膜翼祭兽", "进化腺体幼体"],
        "materials": ["圣肉", "器官花粉", "进化腺液"],
        "locations": ["肉体教堂", "进化温室", "器官圣坛"],
        "visuals": ["恶心", "神圣", "诡异"],
        "style": "银白审判档案",
    },
    {
        "name": "虚舟民",
        "system": "高科技与轨道文明",
        "prefixes": ["虚舟", "舰壳", "真空", "星舰", "航道", "游牧"],
        "interfaces": ["舰壳寄居虫", "真空水母", "星舰清道兽", "航道信标生物"],
        "materials": ["舰壳鳞", "真空囊", "航道晶"],
        "locations": ["星舰墓场", "迁徙航道", "虚舟泊港"],
        "visuals": ["炫酷", "中庸", "星外"],
        "style": "HUB全息冷白",
    },
    {
        "name": "蛾民",
        "system": "诡秘、月光、镜像与身份",
        "prefixes": ["蛾民", "梦粉", "月鳞", "灯尘", "殉光", "夜剧"],
        "interfaces": ["梦粉蛾", "月鳞蜉蝣", "灯尘幼虫", "殉光小兽"],
        "materials": ["鳞粉", "梦毒", "月尘翅"],
        "locations": ["夜城剧院", "月光祭台", "梦毒灯廊"],
        "visuals": ["可爱", "诡异", "悲剧美"],
        "style": "宣纸水墨",
    },
    {
        "name": "蜡骨人",
        "system": "西方魔法、贵族与学院",
        "prefixes": ["蜡骨", "烛骨", "蜡泪", "骨蜡", "火苗", "烛契"],
        "interfaces": ["烛骨虫", "蜡泪犬", "骨蜡蛾", "火苗寄生物"],
        "materials": ["骨蜡", "烛泪", "契约火芯"],
        "locations": ["地下礼拜堂", "契约墓室", "永燃契约炉"],
        "visuals": ["古典", "神圣", "恶心"],
        "style": "暗金书卷档案",
    },
    {
        "name": "血契贵族",
        "system": "西方魔法、贵族与学院",
        "prefixes": ["血契", "契约", "祖债", "血印", "家徽", "古堡"],
        "interfaces": ["契约蝠", "祖债犬", "血印虫", "家族誓约兽"],
        "materials": ["血印", "祖债骨牌", "贵族血蜡"],
        "locations": ["古堡", "贵族档案室", "血债回廊"],
        "visuals": ["古典", "炫酷", "诡异"],
        "style": "暗金书卷档案",
    },
    {
        "name": "裂瞳民",
        "system": "克苏鲁、星外与深海梦境",
        "prefixes": ["裂瞳", "裂缝", "观测", "现实", "缝隙", "界隙"],
        "interfaces": ["裂缝眼虫", "观测蛇", "现实啮齿兽", "缝隙幼体"],
        "materials": ["裂瞳晶", "现实碎屑", "界缝膜"],
        "locations": ["观测站", "裂隙边境", "现实裂口"],
        "visuals": ["诡异", "星外", "中庸"],
        "style": "HUB全息冷白",
    },
    {
        "name": "量子双生族",
        "system": "高科技与轨道文明",
        "prefixes": ["量子", "双身", "概率", "错位", "叠影", "双城"],
        "interfaces": ["双身幼兽", "概率蝶", "错位犬", "叠影寄生虫"],
        "materials": ["概率皮", "叠影核", "双相骨"],
        "locations": ["量子实验室", "双城边界", "概率温室"],
        "visuals": ["炫酷", "诡异", "可爱"],
        "style": "HUB全息冷白",
    },
    {
        "name": "锈裔",
        "system": "赛博工业与城市废土",
        "prefixes": ["锈裔", "锈皮", "废铁", "螺栓", "机械污染", "拆解"],
        "interfaces": ["锈皮犬", "废铁蛾", "螺栓虫", "机械污染鼠"],
        "materials": ["锈鳞", "废铁骨", "污染齿轮"],
        "locations": ["废弃工厂", "拆解场", "锈厂墙缝"],
        "visuals": ["工业", "中庸", "恶心"],
        "style": "锈黑工业档案",
    },
    {
        "name": "镜裔",
        "system": "诡秘、月光、镜像与身份",
        "prefixes": ["镜裔", "镜面", "反光", "延迟影", "屏幕", "冷玻璃"],
        "interfaces": ["镜面鱼", "反光替身虫", "延迟影兽", "屏幕寄生物"],
        "materials": ["镜核", "冷玻璃皮", "延迟影鳞"],
        "locations": ["镜廊", "反光城市", "替身剧场"],
        "visuals": ["诡异", "炫酷", "神圣"],
        "style": "HUB全息冷白",
    },
    {
        "name": "霓虹蛾民",
        "system": "赛博工业与城市废土",
        "prefixes": ["霓虹", "广告", "屏光", "娱乐", "光污染", "地下舞台"],
        "interfaces": ["广告蛾", "屏光虫", "霓虹鳞兽", "娱乐寄生物"],
        "materials": ["霓虹鳞粉", "广告屏残光", "娱乐腺"],
        "locations": ["夜城商圈", "地下舞台", "光污染头目巢"],
        "visuals": ["可爱", "炫酷", "诡异"],
        "style": "黑底涂鸦档案",
    },
]


MODIFIERS = [
    "巡游",
    "回声",
    "折光",
    "低语",
    "逆鳞",
    "雾灯",
    "裂壳",
    "温炉",
    "净盐",
    "梦泡",
    "冷焰",
    "脉冲",
    "盲鳃",
    "碎冠",
    "银喉",
    "伏行",
    "悬骨",
    "蓝焰",
    "酸泪",
    "细足",
    "阈限",
    "余温",
    "断章",
    "潮纹",
    "空腹",
    "眠光",
    "黑边",
    "白瞳",
    "旧誓",
    "流明",
    "缝线",
    "齿轮",
    "盐霜",
    "虹尘",
    "暗核",
    "骨铃",
    "热雾",
    "灰舌",
    "晶背",
    "静脉",
    "小冠",
    "琥珀",
    "棘尾",
    "镜皮",
    "熔泪",
    "脊灯",
    "薄翼",
    "铃腹",
    "残响",
    "星霜",
    "赤纹",
    "银线",
    "雾鳞",
    "纸骨",
    "短角",
    "长吻",
    "秘纹",
    "无影",
    "噬名",
    "青火",
    "缠根",
    "漂盐",
    "空腔",
    "慈悲",
    "躁动",
    "裂梦",
    "燃脊",
    "月粉",
    "喉灯",
    "碎梦",
    "净翼",
    "污银",
    "环眼",
    "剥面",
    "塔脊",
    "碑背",
    "错位",
    "双相",
    "蜡纹",
    "油膜",
]

ACCENTS = [
    "雾芯",
    "星砂",
    "骨环",
    "月痕",
    "盐冠",
    "灰灯",
    "镜核",
    "潮脉",
    "蜡髓",
    "锈鳞",
    "梦线",
    "裂晶",
    "炉髓",
    "纸脊",
    "蓝盐",
    "白烬",
    "黑羽",
    "银苔",
    "脉珠",
    "虹腺",
]

BODIES_BY_RANK = {
    "普通": [
        "蛾",
        "蜗",
        "螺",
        "鼠",
        "鱼",
        "雀",
        "蚁",
        "虱",
        "小蛇",
        "小蜥",
        "幼虫",
        "蜉蝣",
        "蟾",
        "猫",
        "犬",
        "蝠",
        "纸鸟",
        "菌毯",
        "尘蛹",
        "灯虫",
    ],
    "精英": [
        "鹿",
        "豹",
        "鹤",
        "猎犬",
        "铁爪兽",
        "折角兽",
        "翼蛇",
        "盾龟",
        "缝合鸦",
        "巡礼蛛",
        "灵鳞蛟",
        "刃翅虫",
    ],
    "头目": [
        "母虫",
        "门卫兽",
        "炉主",
        "巢主",
        "回廊兽",
        "巨蟹",
        "阵龟",
        "眠鲸",
        "观测蛇王",
        "仓主兽",
    ],
    "首领": [
        "君王",
        "母机",
        "妖主",
        "圣骸",
        "债主",
        "牧者",
        "合唱体",
        "灾兽",
    ],
    "世界级": [
        "世界树",
        "天体胎",
        "诸界牧者",
        "灾厄环",
        "文明胃",
        "命运母巢",
        "黑曜根系",
        "终局圣骸",
    ],
}

ALIGNMENTS = [
    "秩序善良",
    "中立善良",
    "混乱善良",
    "秩序中立",
    "中立",
    "混乱中立",
    "秩序邪恶",
    "中立邪恶",
    "混乱邪恶",
    "双相：中立善良 / 中立邪恶",
]

VISUAL_PACKS = [
    "可爱 / 神圣 / 机械",
    "炫酷 / 星外",
    "恶心 / 工业",
    "中庸 / 腐生",
    "诡异 / 古典",
    "神圣 / 深海",
    "荒诞 / 可爱",
    "野性 / 炫酷",
    "机械 / 中庸",
    "深海 / 诡异",
    "古典 / 悲剧美",
    "赛博 / 可爱",
    "恶心 / 神圣",
    "透明电子 / 诡异",
    "炫酷 / 机械",
]

BIO_TYPES = {
    "普通": ["自然生物", "共生生物", "异化生物", "势力造物", "召唤物"],
    "精英": ["精英生物", "眷族", "势力造物", "异化生物", "神兽"],
    "头目": ["头目生物", "眷族", "区域异化核心", "势力造物"],
    "首领": ["首领生物", "神兽", "眷族首领", "灾厄级生命"],
    "世界级": ["世界级存在", "灾厄级生命", "终局生命"],
}

SIZE_BY_RANK = {
    "普通": ["掌到前臂大小", "小猫到猎犬大小", "一只背包大小", "成人小腿高"],
    "精英": ["战马大小", "小型车辆大小", "两到三人高", "像低矮祭坛一样宽"],
    "头目": ["一座小屋大小", "覆盖半条街巷", "像移动炉塔一样高", "能盘住一座门楼"],
    "首领": ["一座剧院大小", "能遮住整段城墙", "像移动神殿一样缓慢推进"],
    "世界级": ["山脊到城邦尺度", "横跨一片生态区", "像天体器官一样悬在世界边缘"],
}

SHAPES = [
    "背部隆起，腹部收窄，轮廓像被改造过的兽类",
    "主体呈环形或螺旋形，边缘拖着透明膜翼",
    "四肢偏细长，关节处有外露骨片或陶瓷环",
    "身体分成前后两个错位重影，移动时有半拍延迟",
    "躯干像小型容器，内部能看见发光液体或孢尘",
    "头部退化成感应冠、眼环、鳃灯或无脸面盘",
]

MATERIALS = [
    "半透明软壳、陶瓷片、潮湿皮膜和少量金属骨架混在一起",
    "鳞片像旧玻璃与骨蜡拼接，边缘有细小裂纹",
    "皮肤覆盖锈粉、盐霜、灰烬或鳞粉，触碰时会脱落",
    "外壳像纸、骨、肉膜和线路压成的复合标本",
    "体表有湿润器官花、冷光腺体和脉冲状神经线",
]

COLOR_LINES = [
    "主色为冷白、雾蓝和骨灰，边缘带微弱金线",
    "主色为锈黑、黄铜和暗红，关节处有蒸汽冷光",
    "主色为旧纸白、墨黑和月青，局部有幽紫污痕",
    "主色为深海蓝、盐白和病态珍珠光，腹部透出灯火",
    "主色为血红、蜡黄和暗金，像古老契约被烧焦后的颜色",
]

ORGANS = [
    "额前有一圈会开合的眼环",
    "背部排列着可采集的发光囊",
    "尾端拖着像笔刷一样的触须",
    "胸口悬着一枚半透明核心",
    "肋侧长出短小膜翼或鳃帘",
    "四足末端带有钩状陶瓷爪",
    "腹部有缓慢转动的齿轮状骨盘",
    "颈侧挂着像铃铛一样的寄生器官",
]

MOTION = [
    "移动时先出现影子，身体再跟上",
    "呼吸会喷出细雾，在地面留下短暂纹路",
    "受惊时蜷成一团，只露出发光器官",
    "进食时会发出像低频合唱一样的震动",
    "靠近目标时会短暂停顿，像在读取命运或气味",
]

HOOKS = [
    "视觉钩子是会眨眼的环形核心",
    "视觉钩子是背上不断滴落的发光露珠",
    "视觉钩子是半边身体像档案页一样展开",
    "视觉钩子是尾端悬着的小型灯笼器官",
    "视觉钩子是胸口反复浮现的陌生姓名",
    "视觉钩子是每一步都会留下不同颜色的足迹",
    "视觉钩子是头顶像王冠一样的破碎骨片",
    "视觉钩子是腹部透明仓里缓慢游动的幼影",
]

WEAKNESS_POOL = [
    "强电磁干扰会让核心短路，短时失去方向感",
    "净盐、冷铁或无梦火能让它的外壳脆化",
    "被准确叫出真名或种族来源后会停止攻击数息",
    "离开原生栖息地太久会脱水、褪色或裂壳",
    "过量强光会烧毁它的感知器官",
    "连续低频钟声会打断它的群体同步",
    "被切断与母题种族的仪式联系后会迅速衰弱",
    "干净流动水会洗掉它用于定位的残留气味",
]


@dataclass(frozen=True)
class Seed:
    number: int
    seed_id: str
    name: str
    race: dict
    rank: str
    threat: str
    visual: str
    alignment: str
    bio_type: str
    visual_style: str
    habitat: str
    material: str
    interface: str
    purpose: str
    hook: str
    batch: str
    filename: str | None = None


def rank_for(index: int) -> str:
    slot = index % 100
    if slot < 52:
        return "普通"
    if slot < 77:
        return "精英"
    if slot < 91:
        return "头目"
    if slot < 98:
        return "首领"
    return "世界级"


def threat_for(rank: str, index: int) -> str:
    choices = {
        "普通": ["E", "D", "C"],
        "精英": ["C", "B"],
        "头目": ["B", "A"],
        "首领": ["A", "S"],
        "世界级": ["S", "世界级", "终局"],
    }
    values = choices[rank]
    return values[index % len(values)]


def filename_safe(value: str) -> str:
    return re.sub(r'[/:*?"<>|\\\s]+', "_", value).strip("_")


def visual_style_for(race: dict, visual: str, index: int) -> str:
    if "工业" in visual or "赛博" in visual or "机械血肉" in visual:
        return "锈黑工业档案"
    if "古典" in visual or "悲剧美" in visual:
        return "暗金书卷档案"
    if "神圣" in visual and ("机械" in visual or race["name"] in {"白械天使", "肉圣族"}):
        return "银白审判档案"
    if "深海" in visual or "星外" in visual or "透明电子" in visual:
        return "HUB全息冷白"
    if "可爱" in visual and index % 2 == 0:
        return "宣纸水墨"
    return race["style"]


def make_name(number: int, race: dict, rank: str, used_names: set[str]) -> str:
    index = number - 1
    prefix = race["prefixes"][(index // len(RACES) + index) % len(race["prefixes"])]
    modifier = MODIFIERS[(index * 7 + len(race["name"])) % len(MODIFIERS)]
    body = BODIES_BY_RANK[rank][(index * 11 + len(prefix)) % len(BODIES_BY_RANK[rank])]
    name = f"{prefix}{modifier}{body}"
    if name not in used_names:
        return name
    alt = 2
    accent = ACCENTS[(index + alt) % len(ACCENTS)]
    candidate = f"{prefix}{modifier}{accent}{body}"
    while candidate in used_names:
        alt += 1
        accent = ACCENTS[(index + alt) % len(ACCENTS)]
        candidate = f"{prefix}{modifier}{accent}{body}"
    return candidate


def color_for(seed: Seed) -> str:
    style_colors = {
        "HUB全息冷白": "主色为冷白、冰蓝、骨白灰和透明浅青，边缘有扫描线与全息微光。",
        "宣纸水墨": "主色为宣纸白、墨黑、雾青和月白，局部有水墨飞白与纸面污痕。",
        "银白审判档案": "主色为钻石白、冷银和少量血红祷火，边缘有净盐粉尘。",
        "黑底涂鸦档案": "主色为骨白、血红、腐绿与锈黑，主体亮部必须清楚。",
        "暗金书卷档案": "主色为暗金、旧纸白、幽紫和蜡黄，像旧书页与契约印蜡。",
        "锈黑工业档案": "主色为锈黑、黄铜、骨白灰和少量蒸汽冷光。",
        "暗黑奇幻手绘设定": "主色低饱和但主体清晰，用骨白、暗红、雾青或腐绿做可读边缘。",
    }
    return style_colors.get(seed.visual_style, COLOR_LINES[(seed.number + len(seed.name)) % len(COLOR_LINES)])


def rank_label(rank: str) -> str:
    return rank if rank.endswith("级") else f"{rank}级"


def threat_label(threat: str) -> str:
    return threat if threat.endswith("级") else f"{threat}级"


def secondary_material(seed: Seed) -> str:
    for material in seed.race["materials"][1:] + seed.race["materials"][:1]:
        if material != seed.material:
            return material
    return f"{seed.material}残渣"


def build_seeds(seed_count: int, dossier_count: int) -> list[Seed]:
    seeds: list[Seed] = []
    used_names: set[str] = set()
    for number in range(1, seed_count + 1):
        index = number - 1
        race = RACES[index % len(RACES)]
        rank = rank_for(index)
        visual = VISUAL_PACKS[(index * 5 + len(race["name"])) % len(VISUAL_PACKS)]
        if index % 4 == 0:
            visual = f"{race['visuals'][index % len(race['visuals'])]} / {visual.split(' / ')[-1]}"
        alignment = ALIGNMENTS[(index * 3 + len(race["system"]) + len(rank)) % len(ALIGNMENTS)]
        name = make_name(number, race, rank, used_names)
        used_names.add(name)
        bio_type = BIO_TYPES[rank][(index + len(race["name"])) % len(BIO_TYPES[rank])]
        visual_style = visual_style_for(race, visual, index)
        habitat = race["locations"][(index // 3) % len(race["locations"])]
        material = race["materials"][(index // 5) % len(race["materials"])]
        interface = race["interfaces"][(index // 7) % len(race["interfaces"])]
        threat = threat_for(rank, index)
        hook = HOOKS[(index * 13 + len(name)) % len(HOOKS)]
        purpose = purpose_for(rank, race, habitat, material, interface, index)
        batch = "第1批可生图档案" if number <= dossier_count else f"种子储备第{((number - 1) // 1000) + 1}组"
        filename = f"B{number:04d}_{filename_safe(name)}.md" if number <= dossier_count else None
        seeds.append(
            Seed(
                number=number,
                seed_id=f"{number:04d}",
                name=name,
                race=race,
                rank=rank,
                threat=threat,
                visual=visual,
                alignment=alignment,
                bio_type=bio_type,
                visual_style=visual_style,
                habitat=habitat,
                material=material,
                interface=interface,
                purpose=purpose,
                hook=hook,
                batch=batch,
                filename=filename,
            )
        )
    return seeds


def purpose_for(rank: str, race: dict, habitat: str, material: str, interface: str, index: int) -> str:
    if rank == "普通":
        duties = [
            f"填充{habitat}日常生态，并产出{material}",
            f"作为{interface}的低阶变体，提示该区域污染方向",
            f"承担巡路、清道、寄生或预警职能",
        ]
    elif rank == "精英":
        duties = [
            f"守卫{habitat}的关键通道，并强化{race['name']}接口",
            f"把普通生态提升为战斗或仪式遭遇",
            f"携带稳定的{material}，可作为任务目标",
        ]
    elif rank == "头目":
        duties = [
            f"成为{habitat}局部生态中心，控制一群低阶生物",
            f"解释区域污染、失控仪式或资源垄断的来源",
            f"作为副本、据点或巢穴的核心遭遇",
        ]
    elif rank == "首领":
        duties = [
            f"牵动{race['name']}的长期政治、仪式或迁徙方向",
            f"改变{habitat}周边势力平衡",
            f"作为章节级冲突的生物化中心",
        ]
    else:
        duties = [
            f"影响整条{race['system']}生态链和文明秩序",
            f"作为世界级灾变、封印或终局生态的可视核心",
            f"让{race['name']}母题上升为地理级生命现象",
        ]
    return duties[index % len(duties)]


def yaml_list(values: list[str]) -> str:
    return "\n".join(f"  - \"{value}\"" for value in values)


def dossier_text(seed: Seed) -> str:
    idx = seed.number - 1
    race = seed.race
    size = SIZE_BY_RANK[seed.rank][idx % len(SIZE_BY_RANK[seed.rank])]
    shape = SHAPES[(idx * 2 + len(seed.name)) % len(SHAPES)]
    material_line = MATERIALS[(idx * 3 + len(race["name"])) % len(MATERIALS)]
    color = color_for(seed).rstrip("。.")
    organ_a = ORGANS[(idx * 7) % len(ORGANS)]
    organ_b = ORGANS[(idx * 7 + 3) % len(ORGANS)]
    motion = MOTION[(idx * 11) % len(MOTION)]
    weakness = WEAKNESS_POOL[(idx * 13 + len(seed.rank)) % len(WEAKNESS_POOL)]
    tone = "看起来有亲近感，但行为不必善良" if "可爱" in seed.visual else "保持清晰怪异感，不写成抽象黑影"
    ecology = f"{seed.habitat} / {race['system']} / {seed.interface}"
    secondary = secondary_material(seed)
    summary = f"{seed.name}是由[[{race['name']}]]母题衍生的{rank_label(seed.rank)}{seed.bio_type}，用于{seed.purpose}。"
    traits = [
        f"{seed.visual}外观：{seed.hook}",
        f"{organ_a}，{organ_b}",
        f"{seed.material}可作为采集资源",
        f"{motion}",
        f"倾向为{seed.alignment}，不直接复制母题种族道德",
        f"弱点：{weakness}",
    ]
    abilities = ability_lines(seed, race, idx)
    resources = [
        f"{seed.material}：用于仪式、炼金、义体或档案卡素材。",
        f"{secondary}：可作为支线任务或装备升级材料。",
        f"{seed.name}残留的{MODIFIERS[(idx + 9) % len(MODIFIERS)]}痕迹：能追踪其巢穴、主人或污染源。",
    ]
    encounters = encounter_lines(seed, race, idx)
    narrative = narrative_impact(seed, race)

    return f'''---
type: "{seed.bio_type}"
serial: "B{seed.number:04d}"
seed_id: "{seed.seed_id}"
source: "{GENERATOR_SOURCE}"
base:
{yaml_list([f"[[{race['name']}]]", race["system"], seed.interface])}
habitat: "{seed.habitat}"
threat: "{seed.threat}"
rank_role: "{seed.rank}"
alignment: "{seed.alignment}"
visual_tendency: "{seed.visual}"
visual_style: "{seed.visual_style}"
weakness: "{weakness}"
status: "可生图档案"
image_ready: true
node_image: ""
panel_image: ""
card_image: ""
tags:
  - 黑曜纪元
  - 生物
  - 可生图档案
  - 首批1000
---

# {seed.name}

> {summary}

## 通用创作规范
- 遵循 [[生物创作规范]]。
- 本档案来自 [[9999生物种子总表]] 的第 {seed.seed_id} 号种子，并已通过 [[9999生物种子清洗表]] 标记为可扩写。
- `rank_role`、`alignment`、`visual_tendency`、`visual_style` 已显式填写，可进入生图队列。

## 关系
- 分类：{seed.bio_type}
- 母题种族：[[{race['name']}]]
- 所属势力：[[{race['name']}]]
- 所属体系：{race['system']}
- 生态位置：{ecology}
- 栖息地 / 使用场景：{seed.habitat}
- 可被利用：{seed.material} / {secondary} / {seed.interface}

## 一句话简介
{summary}

## 外观
体型：{size}。  
轮廓：{shape}。  
材质：{material_line}。  
颜色：{color}。  
器官：{organ_a}；{organ_b}。  
动态：{motion}。  
视觉钩子：{seed.hook}。  
外观倾向：{seed.visual}，{tone}。

## 行为
- 常在{seed.habitat}附近活动，优先围绕{seed.interface}形成巢群或巡逻路线。
- 遇到陌生目标时会先表现出{seed.alignment}对应的行为气质，再根据环境压力转为攻击、逃逸、引路或寄生。
- 与[[{race['name']}]]的关系不是单纯服从：它可能是共生物、失控副产物、驯养资产、恐惧对象或材料来源。

## 能力
{chr(10).join(f"- {line}" for line in abilities)}

## 弱点
- {weakness}
- 若被迫离开{seed.habitat}，它的{seed.material}会逐渐失活，外观亮度和行动稳定性下降。

## 可采集资源
{chr(10).join(f"- {line}" for line in resources)}

## 遭遇事件
{chr(10).join(f"- {line}" for line in encounters)}

{narrative}

## 生图提示词要点
- 正面设定图：单只{seed.name}，完整露出头部、身体、四肢 / 足 / 翅 / 尾等关键结构，浅灰或浅纸色背景，暗黑奇幻手绘设定图。
- 必须体现：{seed.visual}、{seed.alignment}、{seed.hook}、{organ_a}、{seed.material}。
- 档案卡：竖版 9:16，标题为「{seed.name}」，副标题显示「{seed.bio_type} / {threat_label(seed.threat)} / {seed.rank}」，底部写出生态位、典型行为、可利用素材和弱点。
- 禁止：过度Q版、普通宠物化、主体过黑、背景抢主体、日式武士、和服、鸟居、浮世绘。

## 档案卡内容
- 分类：{seed.bio_type} / {seed.rank}
- 所属势力：[[{race['name']}]]
- 生物倾向：{seed.alignment}
- 生态位：{ecology}
- 职能标签：{seed.purpose}
- 典型行为：围绕{seed.habitat}巡游、筑巢、寄生、引路或守卫。
- 可利用素材：{seed.material}
- 弱点：{weakness}
- 局部特性：
{chr(10).join(f"  - {trait}" for trait in traits)}
'''


def ability_lines(seed: Seed, race: dict, index: int) -> list[str]:
    verbs = [
        f"能把{race['system']}的残余能量储存在{seed.material}里。",
        f"能通过{seed.hook.replace('视觉钩子是', '')}标记猎物、同伴或安全路线。",
        f"能短时间改变{seed.habitat}内的声音、光线、气味或梦境密度。",
        f"能呼唤同源低阶生物，形成小型群体战术。",
        f"能把接触者的恐惧、秘密、热量或神经信号转化为行动燃料。",
    ]
    start = index % len(verbs)
    return [verbs[(start + offset) % len(verbs)] for offset in range(4)]


def encounter_lines(seed: Seed, race: dict, index: int) -> list[str]:
    options = [
        f"在{seed.habitat}发现一串{seed.material}，但每拾取一次都会吸引更多{seed.name}靠近。",
        f"当地人把{seed.name}当成灾兆、宠物、祭品或工业耗材，争夺它会牵出[[{race['name']}]]相关冲突。",
        f"一只受伤的{seed.name}挡在路中间，它既可能引路，也可能把队伍带向巢穴核心。",
        f"{seed.name}的{seed.hook.replace('视觉钩子是', '')}开始异常发光，提示附近有首领级或世界级生态正在苏醒。",
    ]
    start = index % len(options)
    return [options[(start + offset) % len(options)] for offset in range(3)]


def narrative_impact(seed: Seed, race: dict) -> str:
    if seed.rank in {"普通", "精英"}:
        return ""
    if seed.rank == "头目":
        body = f"它能把{seed.habitat}变成局部巢域，解释该区域为什么持续产出{seed.material}、失踪事件或低阶生物潮。"
    elif seed.rank == "首领":
        body = f"它牵动[[{race['name']}]]与周边势力的长期关系，死亡或失控都会改变{seed.habitat}的贸易、信仰或防线。"
    else:
        body = f"它不是单纯巨兽，而是{race['system']}的地理级生命现象；其苏醒会改变文明秩序、栖息地结构和灾变进程。"
    return f"## 叙事影响\n{body}\n"


def generated_file_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return ""


def write_generated(path: Path, text: str) -> None:
    old = generated_file_text(path)
    if old and GENERATOR_SOURCE not in old and path.name.startswith("B"):
        raise RuntimeError(f"Refusing to overwrite non-generated dossier: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def write_seed_table(seeds: list[Seed]) -> None:
    lines = [
        "---",
        'type: "生物种子总表"',
        'status: "9999种子可用"',
        f'source: "{GENERATOR_SOURCE}"',
        "tags:",
        "  - 黑曜纪元",
        "  - 生物",
        "  - 种子总表",
        "  - 长期规则",
        "---",
        "",
        "# 9999生物种子总表",
        "",
        "本表是黑曜纪元全世界观生物构建的 9999 规模种子库。它继承 [[300生物种子总表]] 的方向，但作为后续批量清洗、完整档案扩写和生图队列的主源表。",
        "",
        "使用规则：",
        "- 所有种子后续展开时必须遵循 [[生物创作规范]]。",
        "- 批量推进按 [[生物库生产流程]] 执行。",
        "- 前 1000 个种子已经扩写为 [[首批1000可生图生物索引]] 对应档案。",
        "",
    ]
    for start in range(1, len(seeds) + 1, 300):
        end = min(start + 299, len(seeds))
        lines.append(f"## {start:04d}-{end:04d} 跨体系生物种子")
        lines.append("")
        lines.append("| 编号 | 生物 | 母题 | 层级 | 威胁 | 外观倾向 | 生物倾向 | 用途 |")
        lines.append("| --- | --- | --- | --- | --- | --- | --- | --- |")
        for seed in seeds[start - 1 : end]:
            lines.append(
                f"| {seed.seed_id} | {seed.name} | [[{seed.race['name']}]] / {seed.race['system']} | {seed.rank} | {seed.threat} | {seed.visual} | {seed.alignment} | {seed.purpose} |"
            )
        lines.append("")
    write_generated(SEED_TABLE, "\n".join(lines))


def write_clean_table(seeds: list[Seed]) -> None:
    lines = [
        "---",
        'type: "生物种子清洗表"',
        'status: "9999种子已清洗"',
        f'source: "{GENERATOR_SOURCE}"',
        "tags:",
        "  - 黑曜纪元",
        "  - 生物",
        "  - 种子清洗",
        "---",
        "",
        "# 9999生物种子清洗表",
        "",
        "本表对应 [[9999生物种子总表]]。清洗状态用于决定哪些种子可以进入候选名单、完整档案和生图队列。",
        "",
        "| 编号 | 生物 | 清洗状态 | 母题 | 层级 | 外观倾向 | 生物倾向 | 批次 | 可视化钩子 | 入库建议 |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for seed in seeds:
        suggestion = "已扩写为可生图档案" if seed.filename else "可进入后续批次"
        link = f"[[{Path(seed.filename).stem}|{seed.name}]]" if seed.filename else seed.name
        lines.append(
            f"| {seed.seed_id} | {link} | 可扩写 | [[{seed.race['name']}]] | {seed.rank} | {seed.visual} | {seed.alignment} | {seed.batch} | {seed.hook} | {suggestion} |"
        )
    write_generated(CLEAN_TABLE, "\n".join(lines))


def write_candidates(seeds: list[Seed], dossier_count: int) -> None:
    selected = seeds[:dossier_count]
    lines = [
        "---",
        'type: "批次候选名单"',
        'status: "第1批1000已候选"',
        f'source: "{GENERATOR_SOURCE}"',
        "tags:",
        "  - 黑曜纪元",
        "  - 生物",
        "  - 候选名单",
        "---",
        "",
        "# 第1批1000生物候选名单",
        "",
        "本名单从 [[9999生物种子清洗表]] 抽取前 1000 个已清洗种子，作为首批可生图完整档案的生产批次。",
        "",
        "| 编号 | 生物 | 母题 | 层级 | 外观倾向 | 生物倾向 | 为什么现在扩写 |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for seed in selected:
        lines.append(
            f"| {seed.seed_id} | [[{Path(seed.filename).stem}|{seed.name}]] | [[{seed.race['name']}]] / {seed.race['system']} | {seed.rank} | {seed.visual} | {seed.alignment} | 补足首批1000中{seed.visual}与{seed.alignment}组合，并接入{seed.habitat}。 |"
        )
    write_generated(CANDIDATE_TABLE, "\n".join(lines))


def write_batch_index(seeds: list[Seed], dossier_count: int) -> None:
    selected = seeds[:dossier_count]
    by_rank: dict[str, int] = {}
    by_visual: dict[str, int] = {}
    by_alignment: dict[str, int] = {}
    for seed in selected:
        by_rank[seed.rank] = by_rank.get(seed.rank, 0) + 1
        by_visual[seed.visual] = by_visual.get(seed.visual, 0) + 1
        by_alignment[seed.alignment] = by_alignment.get(seed.alignment, 0) + 1

    lines = [
        "---",
        'type: "生物索引"',
        'status: "首批1000可生图"',
        f'source: "{GENERATOR_SOURCE}"',
        "tags:",
        "  - 黑曜纪元",
        "  - 生物",
        "  - 索引",
        "---",
        "",
        "# 首批1000可生图生物索引",
        "",
        "本索引收录首批 1000 个完整生物档案。每个条目都包含外观、行为、能力、弱点、资源、遭遇事件、生图提示词要点和档案卡内容。",
        "",
        "## 数量概览",
        "",
        f"- 档案数量：{len(selected)}",
        f"- 来源种子：[[9999生物种子总表]] 0001-1000",
        f"- 候选名单：[[{CANDIDATE_TABLE.stem}]]",
        f"- 清洗表：[[{CLEAN_TABLE.stem}]]",
        "",
        "## 层级分布",
        "",
    ]
    for rank in ["普通", "精英", "头目", "首领", "世界级"]:
        lines.append(f"- {rank}：{by_rank.get(rank, 0)}")
    lines.extend(["", "## 外观倾向覆盖", ""])
    for visual, count in sorted(by_visual.items(), key=lambda item: (-item[1], item[0])):
        lines.append(f"- {visual}：{count}")
    lines.extend(["", "## 生物倾向覆盖", ""])
    for alignment, count in sorted(by_alignment.items(), key=lambda item: (-item[1], item[0])):
        lines.append(f"- {alignment}：{count}")
    lines.extend(["", "## 档案列表", ""])
    for start in range(0, len(selected), 100):
        end = min(start + 100, len(selected))
        lines.append(f"### B{start + 1:04d}-B{end:04d}")
        for seed in selected[start:end]:
            lines.append(f"- [[{Path(seed.filename).stem}|{seed.seed_id} {seed.name}]] - {seed.rank} / {seed.visual} / {seed.alignment}")
        lines.append("")
    write_generated(BATCH_INDEX, "\n".join(lines))


def write_dossiers(seeds: list[Seed], dossier_count: int) -> None:
    CREATURE_DIR.mkdir(parents=True, exist_ok=True)
    expected = {seed.filename for seed in seeds[:dossier_count]}
    for path in CREATURE_DIR.glob("B[0-9][0-9][0-9][0-9]_*.md"):
        text = generated_file_text(path)
        if GENERATOR_SOURCE in text and path.name not in expected:
            path.unlink()
    for seed in seeds[:dossier_count]:
        write_generated(CREATURE_DIR / seed.filename, dossier_text(seed))


def generate(seed_count: int, dossier_count: int) -> dict:
    if dossier_count > seed_count:
        raise ValueError("dossier-count cannot exceed seed-count")
    seeds = build_seeds(seed_count, dossier_count)
    write_seed_table(seeds)
    write_clean_table(seeds)
    write_candidates(seeds, dossier_count)
    write_batch_index(seeds, dossier_count)
    write_dossiers(seeds, dossier_count)
    return verify(seed_count, dossier_count)


def verify(seed_count: int, dossier_count: int) -> dict:
    generated_dossiers = sorted(CREATURE_DIR.glob("B[0-9][0-9][0-9][0-9]_*.md"))
    required_frontmatter = [
        "type:",
        "base:",
        "habitat:",
        "threat:",
        "rank_role:",
        "alignment:",
        "visual_tendency:",
        "visual_style:",
        "weakness:",
        "status:",
        "image_ready: true",
    ]
    required_headings = [
        "## 关系",
        "## 一句话简介",
        "## 外观",
        "## 行为",
        "## 能力",
        "## 弱点",
        "## 可采集资源",
        "## 遭遇事件",
        "## 生图提示词要点",
        "## 档案卡内容",
    ]
    bad_files = []
    for path in generated_dossiers[:dossier_count]:
        text = path.read_text(encoding="utf-8")
        missing = [item for item in required_frontmatter + required_headings if item not in text]
        if missing:
            bad_files.append({"file": str(path.relative_to(ROOT)), "missing": missing})

    seed_rows = sum(1 for line in SEED_TABLE.read_text(encoding="utf-8").splitlines() if re.match(r"^\| \d{4} \|", line)) if SEED_TABLE.exists() else 0
    clean_rows = sum(1 for line in CLEAN_TABLE.read_text(encoding="utf-8").splitlines() if re.match(r"^\| \d{4} \|", line)) if CLEAN_TABLE.exists() else 0
    candidate_rows = sum(1 for line in CANDIDATE_TABLE.read_text(encoding="utf-8").splitlines() if re.match(r"^\| \d{4} \|", line)) if CANDIDATE_TABLE.exists() else 0

    return {
        "seed_rows": seed_rows,
        "clean_rows": clean_rows,
        "candidate_rows": candidate_rows,
        "generated_dossiers": len(generated_dossiers),
        "checked_dossiers": min(len(generated_dossiers), dossier_count),
        "bad_files": bad_files[:20],
        "expected": {
            "seed_rows": seed_count,
            "clean_rows": seed_count,
            "candidate_rows": dossier_count,
            "generated_dossiers_at_least": dossier_count,
        },
        "ok": seed_rows == seed_count
        and clean_rows == seed_count
        and candidate_rows == dossier_count
        and len(generated_dossiers) >= dossier_count
        and not bad_files,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build 9999 seeds and the first 1000 image-ready creature dossiers.")
    parser.add_argument("--seed-count", type=int, default=9999)
    parser.add_argument("--dossier-count", type=int, default=1000)
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()

    result = verify(args.seed_count, args.dossier_count) if args.verify_only else generate(args.seed_count, args.dossier_count)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
