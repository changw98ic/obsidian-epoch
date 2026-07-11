#!/usr/bin/env python3
"""Render creature concept sheets, node crops, and dossier cards.

Input:  09_素材与图片/<name>_概念展示.png
Output: 09_素材与图片/<name>_概念展示.png
        09_素材与图片/<name>_节点正面.png
        09_素材与图片/<name>_档案卡.png
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "09_素材与图片"
FONT_PATH = "/System/Library/Fonts/Hiragino Sans GB.ttc"


PALETTES = {
    "gold_rust": {
        "bg": (18, 14, 10),
        "accent": (181, 135, 45),
        "accent2": (108, 58, 24),
        "text": (232, 220, 196),
        "muted": (166, 145, 112),
    },
    "blood_rot": {
        "bg": (18, 6, 7),
        "accent": (178, 35, 38),
        "accent2": (78, 116, 66),
        "text": (235, 215, 198),
        "muted": (142, 93, 78),
    },
    "bone_black": {
        "bg": (9, 9, 10),
        "accent": (202, 190, 166),
        "accent2": (76, 78, 82),
        "text": (232, 225, 207),
        "muted": (138, 132, 120),
    },
    "silver_blood": {
        "bg": (10, 12, 15),
        "accent": (205, 216, 220),
        "accent2": (146, 26, 32),
        "text": (235, 238, 234),
        "muted": (132, 144, 148),
    },
    "moon_ink": {
        "bg": (9, 16, 21),
        "accent": (213, 222, 218),
        "accent2": (74, 104, 116),
        "text": (230, 235, 226),
        "muted": (132, 150, 152),
    },
    "moon_rot": {
        "bg": (10, 18, 16),
        "accent": (207, 220, 210),
        "accent2": (82, 124, 78),
        "text": (228, 232, 216),
        "muted": (128, 150, 120),
    },
    "purple_rot": {
        "bg": (15, 9, 18),
        "accent": (148, 89, 180),
        "accent2": (76, 118, 74),
        "text": (230, 220, 232),
        "muted": (134, 116, 150),
    },
    "lava_rust": {
        "bg": (18, 8, 5),
        "accent": (202, 63, 28),
        "accent2": (116, 62, 30),
        "text": (240, 220, 196),
        "muted": (150, 96, 64),
    },
    "brass_bone": {
        "bg": (16, 14, 12),
        "accent": (176, 126, 58),
        "accent2": (178, 170, 150),
        "text": (232, 222, 205),
        "muted": (138, 126, 106),
    },
    "gold_purple": {
        "bg": (14, 10, 18),
        "accent": (186, 138, 54),
        "accent2": (112, 70, 150),
        "text": (235, 222, 198),
        "muted": (142, 118, 142),
    },
    "sea_black": {
        "bg": (5, 13, 15),
        "accent": (80, 134, 112),
        "accent2": (30, 58, 62),
        "text": (218, 232, 220),
        "muted": (104, 138, 126),
    },
    "star_purple": {
        "bg": (8, 12, 22),
        "accent": (208, 220, 226),
        "accent2": (104, 78, 154),
        "text": (228, 232, 236),
        "muted": (120, 132, 160),
    },
    "steel_rust": {
        "bg": (13, 12, 11),
        "accent": (190, 200, 198),
        "accent2": (126, 62, 34),
        "text": (228, 230, 224),
        "muted": (128, 126, 118),
    },
    "ice_bone": {
        "bg": (7, 13, 18),
        "accent": (198, 230, 240),
        "accent2": (190, 188, 172),
        "text": (226, 238, 238),
        "muted": (130, 156, 164),
    },
    "black_purple": {
        "bg": (8, 5, 12),
        "accent": (108, 72, 150),
        "accent2": (198, 190, 172),
        "text": (230, 220, 232),
        "muted": (128, 112, 144),
    },
}


SPECS = {
    "符芯傀犬": {
        "palette": "gold_rust",
        "faction": "万机符宗",
        "threat": "D",
        "use": "巡逻 / 追踪 / 困阵",
        "weakness": "强磁 / 潮湿 / 反向咒文",
        "note": "成组行动时可封锁阵法边界",
        "stats": [2, 2, 3, 2, 2],
        "panels": [
            ("符芯额盘", "方形铜符头部，\n锁定灵压残痕。"),
            ("黄符芯片", "符箓芯片贴附装甲，\n储存巡逻阵令。"),
            ("阵旗背脊", "机械阵旗沿脊排列，\n可临时布设困阵。"),
            ("齿轮肋骨", "胸腔齿轮外露，\n驱动傀儡奔行。"),
            ("符钉犬口", "口中藏符钉，\n用于封锁阵眼。"),
            ("机械爪足", "爪足抓地稳定，\n适合追踪巡逻。"),
        ],
    },
    "丹瘤药鼠": {
        "palette": "blood_rot",
        "faction": "丹鼎肉仙门",
        "threat": "D",
        "use": "试药 / 钻炉 / 偷食灵材",
        "weakness": "洁净盐水 / 寒气 / 空腹",
        "note": "药瘤破裂会释放不稳定药粉",
        "stats": [2, 1, 3, 2, 2],
        "panels": [
            ("半透鼠皮", "血管与药渣可见，\n肉身持续变异。"),
            ("丹瘤背脊", "药瘤随心跳鼓胀，\n储存失败药性。"),
            ("脐带尾", "拖拽灵材药渣，\n喂养丹胎幼体。"),
            ("腐肉齿", "分泌麻痹唾液，\n啃开缝合创口。"),
            ("瘤爆药粉", "受惊时破裂，\n扩散致幻粉末。"),
            ("炉灰爪", "适合钻入丹炉，\n偷食残余灵材。"),
        ],
    },
    "拾眼骨鸦": {
        "palette": "bone_black",
        "faction": "乌鸦骨庭",
        "threat": "D",
        "use": "拾荒 / 记忆采样 / 死亡预警",
        "weakness": "密闭空间 / 倒影 / 无见证死亡",
        "note": "空眼眶会保存临终画面",
        "stats": [1, 1, 4, 3, 2],
        "panels": [
            ("空洞眼眶", "收集死前视野，\n凝成死忆珠。"),
            ("骨片黑羽", "羽毛薄如焦骨，\n飞行时无声。"),
            ("裂纹喙", "啄食的不是眼球，\n而是最后画面。"),
            ("死忆珠", "可用于战场复盘，\n也会泄露凶手。"),
            ("败亡预叫", "集群落地时，\n预示大量死亡。"),
            ("亡魂引路", "引导战魂返回，\n通往骨庭祭坛。"),
        ],
    },
    "圣银钉鹿": {
        "palette": "silver_blood",
        "faction": "圣银审判庭",
        "threat": "C",
        "use": "猎巫 / 封锁 / 看守",
        "weakness": "狭窄巷道 / 伪造圣徽 / 判断迟滞",
        "note": "圣银角钉可延缓异化恢复",
        "stats": [3, 3, 3, 2, 3],
        "panels": [
            ("圣银钉角", "鹿角由银钉构成，\n低头刺入影子。"),
            ("净盐蹄圈", "绕行后留下盐痕，\n封住退路。"),
            ("血红祷火", "眼窝燃着祷火，\n感应审判钟声。"),
            ("火刑烙痕", "白皮被烧成十字，\n记录审判编号。"),
            ("钉角定罪", "冲撞可固定\n施法姿势。"),
            ("圣徽迟滞", "伪造圣徽会让它\n短暂误判。"),
        ],
    },
    "魂灯纸吏": {
        "palette": "bone_black",
        "faction": "幽都鬼箓司",
        "threat": "D",
        "use": "引魂 / 登记 / 封存执念",
        "weakness": "雨水 / 明火 / 假官印",
        "note": "登记名单偶尔会出现活人姓名",
        "stats": [1, 1, 2, 3, 2],
        "panels": [
            ("纸扎官躯", "泛黄纸身折叠，\n可避开一次冲击。"),
            ("豆大魂灯", "胸腔魂火照出，\n亡魂脚印。"),
            ("铜铃关节", "行走时铃声登记，\n死因与执念。"),
            ("墨线官脸", "官印替代五官，\n只认阴司命令。"),
            ("亡名袖口", "拓印死者姓名，\n封存最后记忆。"),
            ("阴箓纸骨", "纸骨可拆写，\n一次性阴箓。"),
        ],
    },
    "剪梦剑螂": {
        "palette": "moon_ink",
        "faction": "斩念剑庭",
        "threat": "C",
        "use": "剪梦 / 守冢 / 清理污染念头",
        "weakness": "强烈情绪 / 噪声 / 误剪记忆",
        "note": "只啃食睡梦中溢出的杂念",
        "stats": [3, 1, 4, 2, 3],
        "panels": [
            ("瓷白甲壳", "壳面如冷瓷，\n映出青墨剑纹。"),
            ("剑刃前肢", "薄刃无声挥动，\n切开梦魇。"),
            ("青墨腹纹", "腹部剑纹共鸣，\n借剑气加速。"),
            ("面具头部", "头如窄面，\n不显情绪。"),
            ("静默伏击", "完全安静时，\n几乎不可感知。"),
            ("斩梦翅粉", "翅粉可短暂，\n压制噩梦。"),
        ],
    },
    "月井蟾仆": {
        "palette": "moon_rot",
        "faction": "月蚀女巫环",
        "threat": "D",
        "use": "采药 / 蓄毒 / 月井警戒",
        "weakness": "干燥 / 铁器敲击 / 无月环境",
        "note": "不同月相会释放不同毒性",
        "stats": [1, 2, 1, 3, 2],
        "panels": [
            ("苍白湿苔", "皮肤像月光泡白，\n附着冷湿苔纹。"),
            ("十二背疣", "背疣对应月相，\n储存不同毒性。"),
            ("月涎长舌", "可封闭伤口，\n也能封住谎言。"),
            ("井水青眼", "眼如深井，\n能认女巫骨饰。"),
            ("草籽胃囊", "吞下发光草籽，\n夜间返井吐出。"),
            ("月账泥字", "舌尖写药账，\n只在湿泥显形。"),
        ],
    },
    "命线根蛛": {
        "palette": "purple_rot",
        "faction": "根下三女巫",
        "threat": "C",
        "use": "织命 / 监视 / 收集残运",
        "weakness": "随机行动 / 噪音 / 抛币扰动",
        "note": "网住的是被推迟的小事故",
        "stats": [2, 2, 3, 4, 3],
        "panels": [
            ("树瘤蛛躯", "身体如腐烂树瘤，\n内藏命运残丝。"),
            ("骨针细足", "八足像骨针，\n刺入根系缝隙。"),
            ("紫绿腹线", "腹中线团闪烁，\n记录死亡分岔。"),
            ("厄运蛛网", "不拦身体，\n只绊住命数。"),
            ("残运收集", "收走被规避的，\n疾病与背叛。"),
            ("根网传讯", "命运波动回流，\n送往根下织机。"),
        ],
    },
    "炉牙火豚": {
        "palette": "lava_rust",
        "faction": "火纹氏族",
        "threat": "D",
        "use": "拖炭 / 点炉 / 燃烧突进",
        "weakness": "骤冷 / 深水 / 长时间寂静",
        "note": "听到火纹战鼓会进入狂奔",
        "stats": [3, 2, 2, 2, 2],
        "panels": [
            ("火山岩皮", "皮肤布满岩斑，\n缝中透出炉光。"),
            ("黑铁炉牙", "獠牙如炉钩，\n可撞开薄甲。"),
            ("炉腹胃石", "胃石稳定熔符，\n储存炭火。"),
            ("喷星鼻孔", "鼻孔持续喷星，\n点燃炉灰。"),
            ("战鼓狂奔", "听见战鼓后，\n痛觉显著下降。"),
            ("拖炭短蹄", "短蹄适合拖炭，\n也能踏碎矿渣。"),
        ],
    },
    "蒸魂瓶俑": {
        "palette": "brass_bone",
        "faction": "灰烬炼金会",
        "threat": "D",
        "use": "搬运 / 收魂 / 清理实验室",
        "weakness": "玻璃躯干 / 压力表损坏 / 过载",
        "note": "瓶内残魂常混出陌生声音",
        "stats": [1, 1, 2, 3, 2],
        "panels": [
            ("玻璃瓶躯", "厚玻璃内翻涌，\n灰白残魂蒸汽。"),
            ("黄铜肢架", "细腿搬运试剂，\n可替换义体零件。"),
            ("压力表头", "指针随情绪抽搐，\n过载会自爆。"),
            ("残魂冷凝", "瓶壁凝出魂液，\n可显影灵痕。"),
            ("堵漏自封", "遇污染泄漏，\n会塞入裂口。"),
            ("蒸汽遮眼", "受击时喷雾，\n短暂遮挡视线。"),
        ],
    },
    "塔灯书蛾": {
        "palette": "gold_purple",
        "faction": "白塔秘法学院",
        "threat": "D",
        "use": "巡书 / 显文 / 补界",
        "weakness": "粗暴翻书声 / 无文字环境 / 噪音",
        "note": "会聚集在违规读者头顶",
        "stats": [1, 1, 3, 4, 2],
        "panels": [
            ("羊皮卷翅", "翅面如旧卷，\n边缘显出金字。"),
            ("塔灯腹光", "腹部发出微光，\n照亮结界裂缝。"),
            ("紫火触角", "触角末端悬火，\n嗅寻真名残粉。"),
            ("鳞粉显文", "鳞粉落下后，\n隐形暗文浮现。"),
            ("真名嗅尘", "寻找遗失真名，\n与档案碎屑。"),
            ("补界群飞", "群体贴附结界，\n填补细小裂隙。"),
        ],
    },
    "借面狸奴": {
        "palette": "moon_rot",
        "faction": "百相妖庭",
        "threat": "D",
        "use": "侦察 / 偷脸 / 传密信",
        "weakness": "正午直射 / 无表情者 / 面具过多",
        "note": "只能模仿神情和关键词",
        "stats": [1, 1, 4, 4, 2],
        "panels": [
            ("空白面纹", "额上空白面纹，\n用于暂存表情。"),
            ("分叉尾面", "尾尖挂薄皮，\n像小纸面具。"),
            ("灯影步", "在灯笼影中，\n难以被发现。"),
            ("借面触影", "触碰影子后，\n复制强烈表情。"),
            ("妖市识路", "能找到临时，\n妖市交换点。"),
            ("密信短语", "传话不完整，\n只带神情关键词。"),
        ],
    },
    "雾鳞环蛇": {
        "palette": "sea_black",
        "faction": "蛇环海族",
        "threat": "C",
        "use": "巡游 / 标记 / 押送祭品",
        "weakness": "干燥 / 淡水 / 高频声呐",
        "note": "咬痕会形成闭合符环",
        "stats": [3, 2, 4, 3, 3],
        "panels": [
            ("青黑雾鳞", "鳞片在海雾中，\n几乎透明。"),
            ("环形骨刺", "头侧骨刺成环，\n游动留闭合涟漪。"),
            ("符环咬痕", "咬伤后目标，\n在雾中暴露。"),
            ("雾水闪游", "可在水雾交界，\n短距换位。"),
            ("迷航绕行", "群蛇绕船，\n制造局部迷航。"),
            ("毒腺边界", "毒液麻痹祭品，\n维持海雾仪式。"),
        ],
    },
    "星盘瞳雀": {
        "palette": "star_purple",
        "faction": "钦天观星宗",
        "threat": "D",
        "use": "观星 / 传讯 / 灾兆定位",
        "weakness": "阴天 / 地下 / 强光污染",
        "note": "短啼能显出一帧未来危险",
        "stats": [1, 1, 4, 3, 2],
        "panels": [
            ("星盘双瞳", "瞳孔如星盘，\n随天象偏移。"),
            ("黑白冷羽", "羽毛黑白分明，\n胸口散布星点。"),
            ("灾兆短啼", "叫声压缩灾象，\n传回观星楼。"),
            ("眼羽指针", "脱落眼羽可作，\n短效占星针。"),
            ("星辉定位", "夜空可见时，\n永不迷路。"),
            ("异星畏避", "遇旧神轨迹，\n会主动避让。"),
        ],
    },
    "钉环祈虫": {
        "palette": "steel_rust",
        "faction": "铆钉修女",
        "threat": "D",
        "use": "祈祷 / 痛觉警报 / 管道缝合",
        "weakness": "润滑油 / 无痛躯体 / 磁化铁环",
        "note": "摩擦声像低声机械祷告",
        "stats": [1, 2, 3, 3, 2],
        "panels": [
            ("铁环腹节", "腹侧穿满细环，\n移动时互相刮擦。"),
            ("灰白虫壳", "壳面像旧钢，\n带工业圣痕。"),
            ("痛觉触须", "定位伤口、过载，\n和刑具固定点。"),
            ("铁灰黏液", "临时封住漏油，\n与义体裂口。"),
            ("祈声干扰", "群体摩擦声，\n扰乱机械指令。"),
            ("管道潜行", "栖息于管线，\n苦修室墙缝。"),
        ],
    },
    "冰腔雪虱": {
        "palette": "ice_bone",
        "faction": "霜巨原民",
        "threat": "D",
        "use": "清道 / 保冷 / 记忆寄存",
        "weakness": "火焰 / 盐水 / 温暖血液",
        "note": "腹腔冻光保存碎片记忆",
        "stats": [1, 1, 3, 4, 2],
        "panels": [
            ("透明虱壳", "身体近乎透明，\n雪面不留痕。"),
            ("蓝白冻光", "腹腔冻光保存，\n冰层记忆碎屑。"),
            ("寒霜细足", "六足细长，\n可在薄雪下潜行。"),
            ("冰腔卵", "低温保存记忆，\n可作冻忆容器。"),
            ("关节麻痹", "大量附着时，\n让目标僵硬。"),
            ("尸骸清道", "啃食霜巨皮屑，\n骨粉和寒气。"),
        ],
    },
    "黑页书虱": {
        "palette": "black_purple",
        "faction": "黑书会",
        "threat": "C",
        "use": "啃书 / 传播禁句 / 标记读者",
        "weakness": "空白纸 / 遗忘术 / 完全焚毁",
        "note": "会把禁句啃进读者血液",
        "stats": [2, 1, 3, 4, 3],
        "panels": [
            ("黑色逗号躯", "小如米粒，\n背甲文字改写。"),
            ("书页夹口器", "口器像微型书夹，\n啃食页边。"),
            ("禁句入血", "咬伤后咒文，\n在梦中反复朗读。"),
            ("纸影伪装", "藏在纸张、皮革，\n和影子边缘。"),
            ("读者标记", "标记会继续读的，\n危险对象。"),
            ("齿片虫粉", "齿片可刻禁句，\n虫粉诱导梦读。"),
        ],
    },
}


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_PATH, size)


def stroke_text(draw: ImageDraw.ImageDraw, xy, text: str, fnt, fill, stroke, sw: int) -> None:
    draw.text(xy, text, font=fnt, fill=fill, stroke_width=sw, stroke_fill=stroke)


def draw_title(img: Image.Image, name: str, spec: dict, palette: dict) -> Image.Image:
    draw = ImageDraw.Draw(img)
    title_font = font(112)
    sub_font = font(48)
    stroke_text(draw, (48, 38), name, title_font, palette["text"], palette["bg"], 6)
    draw.line((50, 164, 420, 164), fill=palette["accent"], width=8)
    stroke_text(draw, (54, 180), "势力低级生物", sub_font, palette["text"], palette["bg"], 4)
    for off in (10, 18):
        draw.rectangle((off, off, 941 - off, 1672 - off), outline=palette["accent2"], width=2)
    for y in (250, 1125, 1650):
        draw.line((18, y, 923, y), fill=palette["accent2"], width=2)
    return img


def render_card(concept: Image.Image, name: str, spec: dict, palette: dict) -> Image.Image:
    base = Image.new("RGB", (941, 1672), palette["bg"])
    texture = concept.resize((941, 1672), Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(5))
    texture = ImageEnhance.Brightness(texture).enhance(0.28)
    base = Image.blend(base, texture, 0.45)
    draw = ImageDraw.Draw(base)

    title_font = font(104)
    mid_font = font(46)
    head_font = font(42)
    body_font = font(30)
    small_font = font(26)

    draw.rectangle((18, 18, 923, 1654), outline=palette["accent2"], width=3)
    stroke_text(draw, (44, 32), name, title_font, palette["text"], palette["bg"], 6)
    stroke_text(
        draw,
        (50, 158),
        f"势力低级生物   威胁等级：{spec['threat']}",
        mid_font,
        palette["text"],
        palette["bg"],
        4,
    )
    draw.line((50, 225, 890, 225), fill=palette["accent"], width=5)

    # Reusable crops from the generated three-view sheet; enough variation for a dossier.
    crop_boxes = [
        (300, 270, 650, 620),
        (210, 390, 760, 790),
        (180, 600, 760, 1000),
        (290, 500, 680, 900),
        (80, 1160, 460, 1540),
        (500, 1160, 885, 1540),
    ]
    xs = [36, 486]
    ys = [260, 510, 760]
    w = 420
    h = 220
    for index, (heading, body) in enumerate(spec["panels"]):
        x = xs[index % 2]
        y = ys[index // 2]
        draw.rectangle((x, y, x + w, y + h), outline=palette["accent2"], width=3, fill=(25, 20, 18))
        part = concept.crop(crop_boxes[index]).resize((w, h), Image.Resampling.LANCZOS)
        part = ImageEnhance.Contrast(part).enhance(1.12)
        base.paste(part, (x, y))
        overlay = Image.new("RGBA", (w, h), (0, 0, 0, 102))
        base.paste(overlay, (x, y), overlay)
        draw.text((x + 18, y + 12), heading, font=head_font, fill=palette["text"], stroke_width=2, stroke_fill=palette["bg"])
        draw.multiline_text(
            (x + 20, y + 78),
            body,
            font=body_font,
            fill=palette["text"],
            spacing=6,
            stroke_width=1,
            stroke_fill=palette["bg"],
        )

    rows = [
        ("所属：", spec["faction"]),
        ("用途：", spec["use"]),
        ("弱点：", spec["weakness"]),
        ("说明：", spec["note"]),
    ]
    for index, (key, value) in enumerate(rows):
        y = 1030 + index * 70
        draw.rectangle((48, y, 893, y + 54), outline=palette["accent2"], width=2)
        draw.text((68, y + 8), key, font=mid_font, fill=palette["accent"])
        draw.text((210, y + 11), value, font=body_font, fill=palette["text"])

    labels = ["攻击性", "防御力", "机动性", "适应性", "危险性"]
    for i, (label, value) in enumerate(zip(labels, spec["stats"])):
        x = 42 + i * 180
        y = 1365
        draw.text((x, y), label, font=small_font, fill=palette["text"])
        for j in range(5):
            fill = palette["accent"] if j < value else (52, 45, 40)
            draw.rectangle((x + j * 28, y + 42, x + j * 28 + 20, y + 68), fill=fill, outline=palette["muted"])

    return base


def render_one(name: str) -> None:
    spec = SPECS[name]
    palette = PALETTES[spec["palette"]]
    concept_path = ASSET_DIR / f"{name}_概念展示.png"
    node_path = ASSET_DIR / f"{name}_节点正面.png"
    card_path = ASSET_DIR / f"{name}_档案卡.png"

    concept = Image.open(concept_path).convert("RGB").resize((941, 1672), Image.Resampling.LANCZOS)
    concept = draw_title(concept, name, spec, palette)
    concept.save(concept_path)

    node = concept.crop((86, 270, 855, 1039)).resize((768, 768), Image.Resampling.LANCZOS)
    node.save(node_path)

    card = render_card(concept, name, spec, palette)
    card.save(card_path)

    print(f"rendered {name}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("names", nargs="*", help="Creature names to render. Defaults to all known specs.")
    args = parser.parse_args()
    names = args.names or list(SPECS)
    for name in names:
        if name not in SPECS:
            raise SystemExit(f"unknown creature: {name}")
        render_one(name)


if __name__ == "__main__":
    main()
