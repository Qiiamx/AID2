import { createRouter, createWebHistory } from 'vue-router'
import MatchOwner from '@/pages/match-owner.vue';
import MatchViewer from '@/pages/match-viewer.vue';
import TeamPlayer from '@/pages/team-player.vue';
import HelloPage from '@/pages/hello-page.vue';
import JumpingPage from '@/pages/jumping-page.vue';
import Lobby from '@/pages/Lobby.vue';
import MatchPage from '@/pages/MatchPage.vue';
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: HelloPage
    },
    {
      path: '/lobby',
      component: Lobby
    },
    {
      path: '/match',
      component: MatchPage
    },
    {
      path: '/jumping',
      component: JumpingPage,
      children: [
        {
          path: '/player',
          component: TeamPlayer
        }, {
          path: '/owner',
          component: MatchOwner
        }, {
          path: '/viewer',
          component: MatchViewer
        }
      ]
    }
  ],
})

export default router
