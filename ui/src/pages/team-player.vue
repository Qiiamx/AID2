<script setup>
import { inject, onMounted, onUnmounted, ref } from 'vue'
import { useMatchStore } from '@/stores/match'
const { userInfo, match, team1, team2, teamOpr } = useMatchStore()


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
        <h2 v-if="userInfo.team1">Team 1: {{ userInfo.userId }}</h2>
        <h2 v-else-if="userInfo.team2">Team 2: {{ userInfo.userId }}</h2>
        <h2 v-else>异常用户</h2>
    </div>
</template>