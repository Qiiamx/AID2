<script setup>
import { inject, onMounted, onUnmounted, ref } from 'vue'
import { useMatchStore } from '@/stores/match'
const { userInfo, match, team1, team2, matchOpr } = useMatchStore()


const ws = inject('ws')
onMounted(() => {
    console.log(ws.value)
})

onUnmounted(() => {
    ws.value?.close()
})

</script>
<template>
    <div>
        <h2 v-if="userInfo.owner">主持人{{ userInfo.userId }}</h2>
        <h2 v-else>异常用户</h2>
    </div>
    <div class="match">
        <h3>比赛</h3>
        <div v-for="(val, key) in match" :key="key" class="row">
            <label>{{ key }}:</label>

            <!-- 数组 -->
            <template v-if="Array.isArray(val)">
                <input
                v-for="(v,i) in val"
                :key="i"
                v-model="val[i]"
                placeholder="请输入"
                />
                <button @click="val.push('')">+</button>
            </template>

            <!-- 布尔 -->
            <input v-else-if="typeof val === 'boolean'" type="checkbox" v-model="match[key]" />

            <!-- 数字 -->
            <input v-else-if="typeof val === 'number'" type="number" v-model.number="match[key]" />

            <!-- 字符串 -->
            <input v-else v-model="match[key]" />
        </div>
        <button @click="matchOpr.start(ws)">开始</button>
        <button @click="matchOpr.pause(ws)">暂停</button>
        <button @click="matchOpr.end(ws)">结束</button>
        <button @click="matchOpr.nextTurn(ws)">下轮</button>
        <button @click="matchOpr.nextRound(ws)">下回合</button>
        <button @click="matchOpr.show(ws)">开注</button>
    </div>
    <!-- 以下代码最后会封装到组件里, 在所有的页面复用(由参数控制 可见逻辑) -->
    <div class="team1">
        <h3>队伍 A</h3>
        <div v-for="(val, key) in team1" :key="key" class="row">
            <label>{{ key }}:</label>

            <!-- 数组 -->
            <template v-if="Array.isArray(val)">
                <input
                v-for="(v,i) in val"
                :key="i"
                v-model="val[i]"
                placeholder="请输入"
                />
                <button @click="val.push('')">+</button>
            </template>

            <!-- 布尔 -->
            <input v-else-if="typeof val === 'boolean'" type="checkbox" v-model="team1[key]" />

            <!-- 数字 -->
            <input v-else-if="typeof val === 'number'" type="number" v-model.number="team1[key]" />

            <!-- 字符串 -->
            <input v-else v-model="team1[key]" />
        </div>
    </div>
    <div class="team2">
        <h3>队伍 B</h3>
        <div v-for="(val, key) in team2" :key="key" class="row">
            <label>{{ key }}:</label>

            <!-- 数组 -->
            <template v-if="Array.isArray(val)">
                <input
                v-for="(v,i) in val"
                :key="i"
                v-model="val[i]"
                placeholder="请输入"
                />
                <button @click="val.push('')">+</button>
            </template>

            <!-- 布尔 -->
            <input v-else-if="typeof val === 'boolean'" type="checkbox" v-model="team2[key]" />

            <!-- 数字 -->
            <input v-else-if="typeof val === 'number'" type="number" v-model.number="team2[key]" />

            <!-- 字符串 -->
            <input v-else v-model="team2[key]" />
        </div>
    </div>
</template>