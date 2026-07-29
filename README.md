# Typer

让你情不自禁地开始写作！

Typer 是一个支持系统中文输入法的写实机械打字机。按键会推动字车，回车触发真实机械音并让稿纸逐行上卷，退格只回退字车而不擦除已经落下的铅字，退纸后可查看、保存和导出完整稿纸。

产品包含「机械特写」与「作家书桌」两种写作模式。作家书桌提供夜灯木桌、清晨书房、雨夜阁楼三个全屏场景，并可切换黑漆黄铜、象牙白镀镍、深林绿黄铜三款真实机器。场景与机器可以自由组合。

默认的「原片米白」复现参考视频的纸色、宽度、初始露纸高度和压纸尺；「稿纸箱」还提供纤维象牙、民国书简、红格稿纸和蓝线信纸。所选纸张会被记住，并同时用于实机纸面、退纸预览和 2480 × 3508 PNG 导出。

中文与英文共用逐字油墨转印模型，每个字都有确定性的缺墨、压力差、色带纤维断点和轻微重击偏移。机械音效从用户提供的参考视频中逐项取样。

```bash
npm ci
npm run dev
```

生产验证：

```bash
npm run build
npm run test:sites
```

## 机械建模

第一台机器的可见外观冻结为 `public/assets/typewriter-base.png` 与 `public/assets/typewriter-with-paper.png`。Blender 只在这一轮廓内建立真实的按键、字杆、色带、字车、滚筒、压纸杆和稿纸运动，不再另选历史机型作为外观。

当前模型先验证一条完整机械因果链，源码与可编辑文件在 `blender/model-01/`。重新生成：

```bash
blender --background --factory-startup --python blender/model-01/scripts/build_prototype_rig.py
```

视觉资产、生成提示和来源边界见 `ASSET_NOTES.md`，设计对照和交互验证见 `design-qa.md`。
