import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';

/**
 * 番茄家族小件
 * -------------------------------------------------------------------
 * MiniTomato ：迷你立体小番茄（与 TimerCard 大番茄同一套视觉语言：
 *              左上光源径向渐变 + 釉面高光 + 双叶萼片），用于：
 *              统计卡图标、番茄徽章、日历番茄点、空状态。
 * TomatoBurst：勾完成任务时从复选框迸出的一圈小番茄（一次性动画）。
 * TomatoBob  ：空状态里上下轻浮动的小番茄（循环动画）。
 *
 * react-native-svg 的渐变 id 在 app 内是全局命名空间，
 * 多实例会互相解析到第一个定义 —— 这里给每个实例生成唯一 id 规避。
 */

let seq = 0;
const nextId = () => `mt${++seq}`;

export function MiniTomato({
  size = 14,
  style,
}: {
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const gid = useRef(nextId()).current;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <RadialGradient id={`${gid}-body`} cx="0.36" cy="0.3" r="0.95">
          <Stop offset="0" stopColor="#FF8A5E" />
          <Stop offset="0.55" stopColor="#F4552B" />
          <Stop offset="1" stopColor="#D63A12" />
        </RadialGradient>
        <RadialGradient id={`${gid}-leaf`} cx="0.5" cy="0.2" r="1">
          <Stop offset="0" stopColor="#5FB96A" />
          <Stop offset="1" stopColor="#2E8B43" />
        </RadialGradient>

        {/* 果柄 */}
        <Path
          d="M16 4.2 Q16.8 6 16.2 7.6"
          stroke="#2E7D43"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
        {/* 萼片两叶 */}
        <Path
          d="M15.4 7.2 C12 4.6, 8.6 5.6, 7.4 8.6 C10.6 9.7, 13.4 9.1, 15.4 7.2 Z"
          fill={`url(#${gid}-leaf)`}
        />
        <Path
          d="M16.6 7.2 C20 4.6, 23.4 5.6, 24.6 8.6 C21.4 9.7, 18.6 9.1, 16.6 7.2 Z"
          fill={`url(#${gid}-leaf)`}
        />
        {/* 果体 */}
        <Ellipse cx="16" cy="18.4" rx="13" ry="11.4" fill={`url(#${gid}-body)`} />
        {/* 釉面高光 */}
        <Ellipse
          cx="11"
          cy="13.4"
          rx="3.4"
          ry="1.9"
          fill="rgba(255,255,255,0.5)"
          transform="rotate(-26 11 13.4)"
        />
      </Svg>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * 完成任务时的番茄迸发
 * ------------------------------------------------------------------ */

interface Particle {
  dx: number;
  dy: number;
  size: number;
  delay: number;
}

export function TomatoBurst({ trigger }: { trigger: number }) {
  // 粒子参数只在挂载时随机一次，trigger 变化只重播动画
  const particles = useRef<Particle[]>(
    Array.from({ length: 7 }, (_, i) => {
      const angle = (i / 7) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      const dist = 24 + Math.random() * 16;
      return {
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist - 12, // 整体向上偏一点，像从框里蹦出来
        size: 9 + Math.random() * 6,
        delay: i * 22,
      };
    }),
  ).current;
  const anims = useRef(particles.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (trigger <= 0) return;
    Animated.parallel(
      anims.map((v, i) => {
        v.setValue(0);
        return Animated.timing(v, {
          toValue: 1,
          duration: 640,
          delay: particles[i].delay,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        });
      }),
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, zIndex: 6 }}
    >
      {particles.map((p, i) => {
        const v = anims[i];
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: -p.size / 2,
              top: -p.size / 2,
              opacity: v.interpolate({ inputRange: [0, 0.65, 1], outputRange: [1, 1, 0] }),
              transform: [
                { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
                { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, p.dy + 16] }) },
                {
                  scale: v.interpolate({
                    inputRange: [0, 0.55, 1],
                    outputRange: [0.3, 1.15, 0.9],
                  }),
                },
                {
                  rotate: v.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', `${i % 2 === 0 ? 40 : -40}deg`],
                  }),
                },
              ],
            }}
          >
            <MiniTomato size={p.size} />
          </Animated.View>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * 空状态浮浮小番茄
 * ------------------------------------------------------------------ */

export function TomatoBob({ size = 40 }: { size?: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <Animated.View
      style={{
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
          { rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] }) },
        ],
      }}
    >
      <MiniTomato size={size} />
    </Animated.View>
  );
}
