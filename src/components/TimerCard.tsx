import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Defs,
  Ellipse,
  Path,
  RadialGradient,
  Stop,
  LinearGradient as SvgGradient,
} from 'react-native-svg';
import { useTheme } from './ThemeProvider';
import { radius, shadow, spacing } from '../theme';
import { CATEGORY_GLYPH, CATEGORY_LABEL, type MotivationLine } from '../services/motivation';

/**
 * 番茄钟主卡片
 * -------------------------------------------------------------------
 * 这是整个 App 的视觉重心：
 *  - 135° 线性渐变（浅橙 → 深橙）打底，两块径向光斑做「极光」质感
 *  - 倒计时嵌在一颗**立体番茄**里：径向渐变球体 + 高光 + 萼片 + 地面投影，
 *    并带轻微的「呼吸」缩放（运转中的计时器应该是活的，不是一张静态图）
 *  - 半透明玻璃徽章、数字带阴影
 *
 * 纵向节奏（从上到下，间距刻意递减，形成「紧凑收口」的观感）：
 *   状态徽章行 → 番茄舞台（时间数字）→ 进度条 → 激励语带 → 操作按钮
 */

export function TimerCard({
  statusLabel,
  modeIcon,
  timeText,
  unitText,
  taskTitle,
  progress,
  quote,
  soundLabel,
  children,
  style,
}: {
  statusLabel: string;
  modeIcon?: string;
  /** mm:ss */
  timeText: string;
  unitText?: string;
  taskTitle?: string | null;
  /** 0~1，大于 0 才渲染进度条 */
  progress?: number;
  /** 每 3 秒轮换的激励语；不传则不渲染引语带 */
  quote?: MotivationLine | null;
  /** 正在播放的白噪音名（如 "Rain"）；有值才显示 ♪ 徽章 */
  soundLabel?: string | null;
  /** 底部操作按钮区 */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();

  const showProgress = progress !== undefined && progress > 0;
  const pct = showProgress ? Math.min(100, Math.round((progress as number) * 100)) : 0;

  return (
    <LinearGradient
      colors={[c.accentFrom, c.accentTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        {
          borderRadius: radius.xl,
          padding: spacing.lg,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.2)',
        },
        shadow.float,
        style,
      ]}
    >
      {/* 光斑装饰：右上 + 左下，制造流动感 */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -60,
          right: -40,
          width: 200,
          height: 200,
          borderRadius: 100,
          backgroundColor: 'rgba(255,255,255,0.18)',
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: -80,
          left: -50,
          width: 190,
          height: 190,
          borderRadius: 95,
          backgroundColor: 'rgba(255,224,205,0.22)',
        }}
      />

      {/* 顶部：状态徽章 + 模式图标 */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: c.onAccent,
            borderWidth: 1,
            borderColor: c.onAccentBorder,
            borderRadius: radius.pill,
            paddingVertical: 8,
            paddingHorizontal: 16,
          }}
        >
          <Text style={{ fontSize: 13 }}>◷</Text>
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 13,
              fontWeight: '800',
              letterSpacing: 0.4,
            }}
          >
            {statusLabel.toUpperCase()}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* 白噪音正在播放：显式可见，否则用户会以为「App 没有声音」 */}
          {soundLabel ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: c.onAccent,
                borderWidth: 1,
                borderColor: c.onAccentBorder,
                borderRadius: radius.pill,
                paddingVertical: 8,
                paddingHorizontal: 13,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>♪</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' }} numberOfLines={1}>
                {soundLabel}
              </Text>
            </View>
          ) : null}

          {modeIcon ? (
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: c.onAccent,
                borderWidth: 1,
                borderColor: c.onAccentBorder,
              }}
            >
              <Text style={{ fontSize: 18 }}>{modeIcon}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* 番茄舞台：倒计时嵌在立体番茄中央 */}
      <TomatoStage timeText={timeText} unitText={unitText} taskTitle={taskTitle} />

      {/* 进度条：通栏，随卡片宽度自适应（原来是固定 150px，看着像悬浮的小方块） */}
      {showProgress ? (
        <View
          style={{
            marginTop: spacing.md,
            height: 5,
            borderRadius: 3,
            backgroundColor: 'rgba(255,255,255,0.26)',
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${pct}%`,
              height: 5,
              borderRadius: 3,
              backgroundColor: '#FFFFFF',
            }}
          />
        </View>
      ) : null}

      {/* 激励语带：固定高度，避免文案长短变化把卡片撑得一跳一跳 */}
      {quote ? <QuoteBand quote={quote} /> : null}

      {/* 操作区 */}
      {children ? <View style={{ marginTop: spacing.lg }}>{children}</View> : null}
    </LinearGradient>
  );
}

/* ------------------------------------------------------------------ *
 * 番茄舞台
 * ------------------------------------------------------------------ */

/**
 * 立体番茄 + 倒计时数字。
 * 立体感来自四层叠加（全部用 SVG 渐变实现，不依赖任何图片资源）：
 *   1. 球体：径向渐变，高光中心偏左上（光源约定俗成在左上）
 *   2. 高光：两块白色椭圆，径向渐变到全透明，模拟釉面反光
 *   3. 分瓣凹槽：三条纵向弧线，番茄不是完美球体
 *   4. 地面投影：底部一片渐隐椭圆，让它「放」在卡纸上而不是「贴」在卡纸上
 */
function TomatoStage({
  timeText,
  unitText,
  taskTitle,
}: {
  timeText: string;
  unitText?: string;
  taskTitle?: string | null;
}) {
  /** 呼吸：1.7s 吸 + 1.7s 呼，幅度只有 2.5% —— 可感知但不抢注意力 */
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 1700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 1700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath]);

  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] });

  return (
    <View
      style={{
        width: '100%',
        maxWidth: 330,
        aspectRatio: 320 / 288,
        alignSelf: 'center',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.xs,
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale }],
        }}
      >
        <TomatoArt />
      </Animated.View>

      {/* 数字压在番茄几何中心略偏下（视觉中心比几何中心低，顶部被萼片占了） */}
      <View style={{ alignItems: 'center', paddingTop: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 58,
              fontWeight: '800',
              letterSpacing: -2.5,
              lineHeight: 68,
              fontVariant: ['tabular-nums'],
              textShadowColor: 'rgba(90,15,0,0.45)',
              textShadowRadius: 14,
              textShadowOffset: { width: 0, height: 4 },
            }}
          >
            {timeText}
          </Text>
          {unitText ? (
            <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 20, fontWeight: '700', marginLeft: 7 }}>
              {unitText}
            </Text>
          ) : null}
        </View>

        {taskTitle ? (
          <Text
            numberOfLines={1}
            style={{
              color: 'rgba(255,255,255,0.94)',
              fontSize: 12.5,
              fontWeight: '700',
              marginTop: 2,
              maxWidth: 210,
              textAlign: 'center',
              textShadowColor: 'rgba(90,15,0,0.4)',
              textShadowRadius: 8,
              textShadowOffset: { width: 0, height: 2 },
            }}
          >
            {taskTitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** 番茄本体（纯 SVG，viewBox 320×288） */
function TomatoArt() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 320 288">
      <Defs>
        {/* 球体：光源在左上 */}
        <RadialGradient id="tomatoBody" cx="0.38" cy="0.3" r="0.95">
          <Stop offset="0" stopColor="#FF9E80" />
          <Stop offset="0.42" stopColor="#FF5E3A" />
          <Stop offset="0.78" stopColor="#E8431F" />
          <Stop offset="1" stopColor="#AD2A0F" />
        </RadialGradient>
        {/* 釉面高光：中心实、边缘散 */}
        <RadialGradient id="tomatoShine" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.5" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </RadialGradient>
        {/* 地面投影 */}
        <RadialGradient id="tomatoGround" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#701A06" stopOpacity="0.4" />
          <Stop offset="1" stopColor="#701A06" stopOpacity="0" />
        </RadialGradient>
        {/* 萼片 */}
        <SvgGradient id="tomatoLeaf" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#6FC276" />
          <Stop offset="1" stopColor="#2E7D32" />
        </SvgGradient>
      </Defs>

      {/* 地面投影：先画，被果实压住边缘 */}
      <Ellipse cx="160" cy="266" rx="112" ry="17" fill="url(#tomatoGround)" />

      {/* 果实：略扁的椭球 */}
      <Ellipse cx="160" cy="164" rx="128" ry="112" fill="url(#tomatoBody)" />

      {/* 分瓣凹槽：只画上 2/3，画满会被误读成「嘴巴」 */}
      <Path
        d="M160 62 Q152 128 157 196"
        stroke="rgba(140,25,5,0.20)"
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M96 88 Q80 148 100 200"
        stroke="rgba(140,25,5,0.13)"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M224 88 Q240 148 220 200"
        stroke="rgba(140,25,5,0.13)"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />

      {/* 主高光 + 次高光 */}
      <Ellipse cx="102" cy="114" rx="54" ry="30" fill="url(#tomatoShine)" transform="rotate(-24 102 114)" />
      <Ellipse cx="62" cy="152" rx="15" ry="8" fill="rgba(255,255,255,0.32)" transform="rotate(-32 62 152)" />

      {/* 萼片：同一条叶子旋转五份，短小贴着果肩，不遮果实 */}
      {[-140, -75, -12, 52, 116].map(a => (
        <Path
          key={a}
          d="M160 64 Q206 60 234 88 Q238 97 229 100 Q194 102 164 78 Q154 70 160 64 Z"
          fill="url(#tomatoLeaf)"
          transform={`rotate(${a} 160 64)`}
        />
      ))}

      {/* 果蒂 */}
      <Path
        d="M149 44 Q156 24 162 16 Q169 26 171 46 Q160 54 149 44 Z"
        fill="#33691E"
      />
    </Svg>
  );
}

/**
 * 激励语带
 * -------------------------------------------------------------------
 * 关键点是**高度写死**：3 秒换一句，文案长度不一致，
 * 若让内容撑开高度，整张卡片会不停上下抖动，非常廉价。
 * 这里固定 48pt 高 + 两行截断，换句时只做淡入位移，卡片外形完全不动。
 */
function QuoteBand({ quote }: { quote: MotivationLine }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 换句瞬间归零再淡入，形成一次轻量「翻页」而不是硬切
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [quote.text, anim]);

  return (
    <View
      style={{
        marginTop: spacing.md,
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        backgroundColor: 'rgba(255,255,255,0.16)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
        overflow: 'hidden',
      }}
    >
      <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 11 }}>
        {CATEGORY_GLYPH[quote.category]}
      </Text>

      <Animated.Text
        numberOfLines={2}
        style={{
          flex: 1,
          color: 'rgba(255,255,255,0.96)',
          fontSize: 12.5,
          lineHeight: 17,
          fontWeight: '600',
          fontStyle: 'italic',
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) }],
        }}
      >
        {quote.text}
      </Animated.Text>

      <Text
        numberOfLines={1}
        style={{
          color: 'rgba(255,255,255,0.62)',
          fontSize: 9,
          fontWeight: '800',
          letterSpacing: 0.7,
          textTransform: 'uppercase',
        }}
      >
        {CATEGORY_LABEL[quote.category]}
      </Text>
    </View>
  );
}

/**
 * 番茄钟卡片上的圆形按钮
 * 主按钮是白底橙字，左右两个是半透明玻璃圆钮 —— 与参考稿一致。
 */
export function TimerActionButton({
  label,
  icon,
  onPress,
  variant = 'ghost',
}: {
  label?: string;
  icon?: string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost';
}) {
  const c = useTheme();

  if (variant === 'primary') {
    return (
      <Text
        onPress={onPress}
        suppressHighlighting
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: '#FFFFFF',
          color: c.accent,
          fontSize: 16,
          fontWeight: '800',
          paddingVertical: 15,
          paddingHorizontal: 32,
          borderRadius: radius.pill,
          shadowColor: '#000',
          shadowOpacity: 0.22,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          overflow: 'hidden',
        }}
      >
        {icon ? <Text style={{ color: c.accent, fontSize: 15 }}>{icon}</Text> : null}
        {label ? <Text style={{ color: c.accent, fontSize: 16, fontWeight: '800' }}>{label}</Text> : null}
      </Text>
    );
  }

  return (
    <View
      style={{
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.onAccent,
        borderWidth: 1,
        borderColor: c.onAccentBorder,
      }}
      onTouchEnd={onPress}
    >
      <Text style={{ fontSize: 19, color: '#FFFFFF' }}>{icon}</Text>
    </View>
  );
}
