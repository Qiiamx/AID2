<template>
    <RouterView></RouterView>
</template>
<script setup>
    
import { onMounted, onUnmounted, provide, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMatchStore } from '@/stores/match'
const route = useRoute()
const router = useRouter()
const { userInfo, serverOpr } = useMatchStore()
const shareId = route.query.shareId
const ws = ref()        // WebSocket 实例
provide('ws', ws)
onMounted(() => {
    userInfo.userId = randomId()
    if (!shareId) {
        return
    }
    // 1. 连接
    const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    let wsUrl = `${wsProtocol}//${location.host}/ws?userId=${userInfo.userId}&shareId=${shareId}`;
    if(location.host.indexOf('localhost')>=0 || location.host.indexOf('127.0.0.1')>=0){
        wsUrl = `http://127.0.0.1:3000/ws?userId=${userInfo.userId}&shareId=${shareId}`;
    }
    ws.value = new WebSocket(wsUrl)

    // 2. 监听事件
    ws.value.onopen = () => console.log('✅ ws opened')
    ws.value.onmessage = (e) => {
        // 连接成功时,会分发到指定的页面, 主持去owner, 选手去 player, 观众去 viewer
        let data = JSON.parse(e.data)
        if(data.type){
            switch(data.type){
                case 'owner': userInfo.owner=true;router.push('/owner'); break; 
                case 'team1': userInfo.team1=true;router.push('/player'); break; 
                case 'team2': userInfo.team2=true;router.push('/player'); break; 
                case 'viewer': userInfo.viewer=true;router.push('/viewer'); break; 
            }
        }else{
            serverOpr.render(data)
        }
    }
    ws.value.onclose = () => console.log('❌ ws closed')
})

onUnmounted(() => {
    ws.value?.close()
})
const randomId = ()=>{
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}
</script>