// server.js
const http = require('http');
const url = require('url');
const WebSocket = require('ws');
const axios = require('axios'); // 引入请求库
const fs = require('fs');
const path = require('path');

// --- B站信息缓存 (防止被B站限流) ---
// 结构: { uid: { name: 'xxx', avatar: 'http...' } }
const biliCache = new Map();

/* 内存结构
    shareMap : Map<shareId, {roomId, type}> // type = team1 / team2 / owner / viewer
    userMap : Map<userId, {roomId, client, socketId}>
    roomMap : Map<roomId, Set<userId>>   // 仅存 userId，方便清理
    rooms : { "hostKey": { hosts: [], teamA: [], teamB: [], spectators: [] } } // 房间数据，key为HOST的key
*/
const shareMap = new Map();
const userMap = new Map();
const roomMap = new Map();
const rooms = {}; // 房间数据存储，key为HOST的key
let keyToRoomMap = {}; // key到房间的映射 { "key": "hostKey" } - 所有key都映射到HOST key

// 房间游戏状态存储
// 结构: { "hostKey": { gamePhase, openingOperators, countdownTimer, currentRound, ... } }
const gameStates = {};

// 加载干员数据（从ui目录读取）
let operatorsData = [];
let branchesData = [];
try {
    const operatorsPath = path.join(__dirname, '../ui/src/assets/operators.json');
    console.log(`[服务器] 尝试加载干员数据，路径: ${operatorsPath}`);
    console.log(`[服务器] 文件是否存在: ${fs.existsSync(operatorsPath)}`);
    
    if (!fs.existsSync(operatorsPath)) {
        console.error(`[服务器] 错误：文件不存在！路径: ${operatorsPath}`);
        console.error(`[服务器] 当前工作目录: ${process.cwd()}`);
        console.error(`[服务器] __dirname: ${__dirname}`);
    } else {
        // 尝试多种方式读取文件
        let operatorsRaw = null;
        try {
            // 方法1: 使用 utf8 编码
            operatorsRaw = fs.readFileSync(operatorsPath, { encoding: 'utf8' });
        } catch (readError) {
            try {
                // 方法2: 使用 utf-8 编码（带连字符）
                operatorsRaw = fs.readFileSync(operatorsPath, { encoding: 'utf-8' });
            } catch (readError2) {
                // 方法3: 读取为 Buffer 然后转换为字符串
                const buffer = fs.readFileSync(operatorsPath);
                operatorsRaw = buffer.toString('utf8');
            }
        }
        
        console.log(`[服务器] 文件读取成功，大小: ${operatorsRaw.length} 字符`);
        
        // 清理可能的 BOM 或其他隐藏字符
        // 当文件以 UTF-8 BOM 保存时，Node.js 读取为字符串后，BOM 表现为 U+FEFF 字符
        if (operatorsRaw.length > 0 && operatorsRaw.charCodeAt(0) === 0xFEFF) {
            operatorsRaw = operatorsRaw.slice(1);
            console.log(`[服务器] 已移除 BOM 标记`);
        }
        
        // 如果上面的方法没有移除 BOM（某些情况下 BOM 可能以其他形式存在），
        // 尝试检查文件开头的字节序列
        if (operatorsRaw.length > 0 && operatorsRaw.startsWith('\uFEFF')) {
            operatorsRaw = operatorsRaw.slice(1);
            console.log(`[服务器] 已移除 BOM 标记（备用方法）`);
        }
        
        // 去除首尾空白字符
        operatorsRaw = operatorsRaw.trim();
        
        // 尝试解析 JSON
        try {
            operatorsData = JSON.parse(operatorsRaw);
            console.log(`[服务器] JSON 解析成功，数组长度: ${operatorsData.length}`);
            
            // 验证数据格式
            if (!Array.isArray(operatorsData)) {
                console.error(`[服务器] 错误：数据不是数组！类型: ${typeof operatorsData}`);
                operatorsData = [];
            } else if (operatorsData.length === 0) {
                console.warn(`[服务器] 警告：数组为空！`);
            } else {
                // 检查第一个元素的结构
                const firstItem = operatorsData[0];
                console.log(`[服务器] 第一个干员示例:`, {
                    name: firstItem['干员'] || firstItem.name,
                    profession: firstItem['职业'] || firstItem.profession,
                    rarity: firstItem['稀有度'] || firstItem.rarity
                });
                
                // 统计1-5星干员数量
                const rarityCount = {};
                for (let rarity = 1; rarity <= 5; rarity++) {
                    const count = operatorsData.filter(op => parseInt(op['稀有度']) === rarity).length;
                    rarityCount[rarity] = count;
                }
                console.log(`[服务器] 各星级干员数量:`, rarityCount);
            }
        } catch (parseError) {
            console.error(`[服务器] JSON 解析失败:`, parseError.message);
            console.error(`[服务器] 错误位置:`, parseError.stack);
            // 尝试显示文件的前200个字符和后200个字符，帮助调试
            console.error(`[服务器] 文件开头内容:`, operatorsRaw.substring(0, 200));
            console.error(`[服务器] 文件结尾内容:`, operatorsRaw.substring(Math.max(0, operatorsRaw.length - 200)));
            operatorsData = [];
        }
    }
} catch (error) {
    console.error('[服务器] 加载干员数据失败:', error.message);
    console.error('[服务器] 错误堆栈:', error.stack);
    operatorsData = [];
}

// 加载分支数据（从ui目录读取）
try {
    const branchesPath = path.join(__dirname, '../ui/src/assets/branches.json');
    console.log(`[服务器] 尝试加载分支数据，路径: ${branchesPath}`);
    console.log(`[服务器] 文件是否存在: ${fs.existsSync(branchesPath)}`);
    
    if (!fs.existsSync(branchesPath)) {
        console.error(`[服务器] 错误：分支文件不存在！路径: ${branchesPath}`);
    } else {
        // 尝试多种方式读取文件
        let branchesRaw = null;
        try {
            branchesRaw = fs.readFileSync(branchesPath, { encoding: 'utf8' });
        } catch (readError) {
            try {
                branchesRaw = fs.readFileSync(branchesPath, { encoding: 'utf-8' });
            } catch (readError2) {
                const buffer = fs.readFileSync(branchesPath);
                branchesRaw = buffer.toString('utf8');
            }
        }
        
        console.log(`[服务器] 分支文件读取成功，大小: ${branchesRaw.length} 字符`);
        
        // 清理可能的 BOM
        if (branchesRaw.length > 0 && branchesRaw.charCodeAt(0) === 0xFEFF) {
            branchesRaw = branchesRaw.slice(1);
            console.log(`[服务器] 已移除分支文件 BOM 标记`);
        }
        if (branchesRaw.length > 0 && branchesRaw.startsWith('\uFEFF')) {
            branchesRaw = branchesRaw.slice(1);
            console.log(`[服务器] 已移除分支文件 BOM 标记（备用方法）`);
        }
        
        branchesRaw = branchesRaw.trim();
        
        // 尝试解析 JSON
        try {
            branchesData = JSON.parse(branchesRaw);
            console.log(`[服务器] 分支 JSON 解析成功，数组长度: ${branchesData.length}`);
            
            if (!Array.isArray(branchesData)) {
                console.error(`[服务器] 错误：分支数据不是数组！类型: ${typeof branchesData}`);
                branchesData = [];
            } else if (branchesData.length > 0) {
                const firstItem = branchesData[0];
                console.log(`[服务器] 第一个分支示例:`, {
                    branch: firstItem['分支'] || firstItem.branch,
                    profession: firstItem['所属职业'] || firstItem.profession
                });
            }
        } catch (parseError) {
            console.error(`[服务器] 分支 JSON 解析失败:`, parseError.message);
            branchesData = [];
        }
    }
} catch (error) {
    console.error('[服务器] 加载分支数据失败:', error.message);
    branchesData = [];
}

// 职业中英文映射
const professionMap = {
    '狙击': 'SNIPER',
    '术师': 'CASTER',
    '近卫': 'GUARD',
    '重装': 'DEFENDER',
    '医疗': 'MEDIC',
    '先锋': 'VANGUARD',
    '辅助': 'SUPPORTER',
    '特种': 'SPECIALIST'
};

// 抽取开局干员（服务器端）
const drawOpeningOperators = (bannedMap, takenOperators) => {
    const selectedOps = [];
    const pool = [];
    
    // 检查干员数据是否加载
    if (!operatorsData || operatorsData.length === 0) {
        console.error('[抽取开局干员] 错误：operatorsData 为空或未加载！');
        // 返回空数组，让调用方处理
        return [];
    }
    
    // 筛选所有1-5星的干员
    for (let rarity = 1; rarity <= 5; rarity++) {
        const ops = operatorsData.filter(op => parseInt(op.稀有度) === rarity)
        .filter(op=>!takenOperators.has(op.干员))
        .filter(op=> ! (bannedMap[op.分支] && bannedMap[op.分支].operators.some(item => item.name === op.干员)  ))
        // .filter(op => {
        //     if(!takenOperators){
        //         return true
        //     }
        //     return takenOperators?.has(op.干员) // 未抽取
        // }).filter(op => {
        //     if(!bannedMap){
        //         return true
        //     }
        //     let target = bannedMap[op.分支]?.operators?.filter(t=>t.name == op.干员)
        //     return target == null || target.length == 0
        // }) // 未禁用
        pool.push(...ops);
    }
    
    console.log(`[抽取开局干员] 可用干员池大小: ${pool.length}`);
    
    // 随机选择3名（不重复）
    const usedIndices = new Set();
    while (selectedOps.length < 3 && pool.length > 0) {
        const randomIndex = Math.floor(Math.random() * pool.length);
        
        if (usedIndices.has(randomIndex)) {
            if (usedIndices.size >= pool.length) {
                break;
            }
            continue;
        }
        
        usedIndices.add(randomIndex);
        const randomOp = pool[randomIndex];
        
        const formattedOp = {
            name: randomOp.干员,
            rarity: parseInt(randomOp.稀有度),
            profession: professionMap[randomOp.职业] || randomOp.职业,
            professionCn: randomOp.职业,
            subClass: randomOp.分支,
            avatar: `/icon/头像_${randomOp.干员}.png`,
            cost: 0,
            isRevealed: selectedOps.length < 2,
            isStarRevealed: selectedOps.length < 2,
            isSubclassRevealed: selectedOps.length < 2
        };
        
        selectedOps.push(formattedOp);
        console.log(`[抽取开局干员] 已抽取: ${formattedOp.name} (${formattedOp.professionCn})`);
    }
    
    // 如果抽取不足3名，用占位符填充
    if (selectedOps.length < 3) {
        console.warn(`[抽取开局干员] 警告：只抽取到 ${selectedOps.length} 名干员，使用占位符填充`);
        const allProfessions = ['近卫', '狙击', '术师', '医疗', '重装', '先锋', '辅助', '特种'];
        while (selectedOps.length < 3) {
            const randomProfession = allProfessions[Math.floor(Math.random() * allProfessions.length)];
            selectedOps.push({
                name: `未知${randomProfession}`,
                rarity: 5,
                profession: professionMap[randomProfession] || randomProfession,
                professionCn: randomProfession,
                subClass: '未知分支',
                avatar: `/images/${randomProfession}.png`,
                cost: 0,
                isRevealed: selectedOps.length < 2,
                isStarRevealed: selectedOps.length < 2,
                isSubclassRevealed: selectedOps.length < 2
            });
        }
    }
    
    console.log(`[抽取开局干员] 最终抽取结果:`, selectedOps.map(op => op.name));
    return selectedOps;
};

// 抽取博弈阶段单个干员（服务器端）
// 过滤禁用池和已占用的干员
const drawOneOperator = (hostKey) => {
    // 【重要】禁用池（bannedMap 和 takenOperators）是全局共享的，不会在重新开始时被重置
    if (!gameStates[hostKey]) {
        gameStates[hostKey] = {
            gamePhase: 'OPENING',
            currentRound: 1,
            isBidding: false,
            isFirstRound: true,
            openingOperators: [],
            countdownTimer: null,
            countdownValue: 10000,
            // 博弈阶段新增状态
            bannedBranches: new Set(), // 禁用的分支
            takenOperators: new Set(), // 已占用的干员名称 - 全局共享，不会重置
            teamAAction: { type: null, bid: 0, usedIntel: false },
            teamBAction: { type: null, bid: 0, usedIntel: false },
            teamAIntel: false, // 队伍A是否解锁了情报
            teamBIntel: false, // 队伍B是否解锁了情报
            currentBiddingOp: null, // 当前博弈的干员
            biddingTimer: null, // 博弈倒计时定时器
            biddingTimeLeft: 25, // 剩余时间（秒）
            isPaused: false, // 【新增】是否已暂停
            // 预选档位（用于超时自动出价）
            teamAPreBid: null,
            teamBPreBid: null,
            // 资源管理（初始值：50调用点，1情报点）
            teamAResources: { cp: 50, ip: 1 },
            teamBResources: { cp: 50, ip: 1 },
            // 终止状态
            teamATerminated: false, // A队是否已终止
            teamBTerminated: false, // B队是否已终止
            firstTerminatedTeam: null, // 谁先终止（用于决定攻略阶段先手）：'A' 或 'B'
            // 【新增】记录终止发生的回合，用于判断单边模式是否生效
            teamATerminatedRound: null, // A队终止时的回合数
            teamBTerminatedRound: null, // B队终止时的回合数
            // 攻略准备阶段
            strategyTurn: null,        // 当前轮到谁攻略: 'A' or 'B'
            tempStrategyOps: [],       // 当前正在中心区域挑选的临时列表
            teamAStrategyOps: [],   // A队攻略阶段选中的干员（临时）
            teamBStrategyOps: [],   // B队攻略阶段选中的干员（临时）
            teamADeployed: [],         // A队最终确认部署的干员
            teamBDeployed: [],         // B队最终确认部署的干员
            teamAStrategyConfirmed: false,
            teamBStrategyConfirmed: false,
            // 队伍干员列表（用于禁用池逻辑验证）
            teamAOperators: [],        // A队当前拥有的所有干员（包括开局干员和博弈抓取的）
            teamBOperators: [],        // B队当前拥有的所有干员（包括开局干员和博弈抓取的）
            // 禁用池映射（用于前端显示）- 全局共享，不会重置
            bannedMap: {},              // { subClass: { professionCn: "职业", operators: [{ name, avatar }] } } - 首次创建时初始化为空，后续不会重置
            // 【新增】自动循环相关字段
            timerType: null,            // 当前定时器类型：'BIDDING' | 'RESULT' | 'COOLDOWN' | 'ANIMATION'
            phaseTimeLeft: 0,           // 当前阶段的剩余时间（用于 RESULT 和 COOLDOWN）
            activeTimer: null           // 统一的定时器引用（用于结果展示和冷却阶段）
        };
    } else {
        // 【重要】如果状态已存在，确保禁用池相关状态已初始化，但不要重置它们
        if (!gameStates[hostKey].bannedMap) {
            gameStates[hostKey].bannedMap = {};
        }
        if (!gameStates[hostKey].takenOperators) {
            gameStates[hostKey].takenOperators = new Set();
        }
    }
    
    const state = gameStates[hostKey];
    const pool = [];
    
    // 筛选所有干员（不限星级，博弈阶段可以抽取任意干员）
    for (const op of operatorsData) {
        // 过滤：不在禁用分支中，且未被占用
        const isBanned = state.bannedBranches && state.bannedBranches.has(op.分支);
        const isTaken = state.takenOperators && state.takenOperators.has(op.干员);
        const isPublic = state.openingOperators && state.openingOperators.some(t=>t.name==op.干员)
        
        if (!isBanned && !isTaken && !isPublic) {
            pool.push(op);
        }
    }
    
    if (pool.length === 0) {
        console.log(`[博弈抽取] 房间 ${hostKey} 池子已空，无法继续抽取`);
        return null;
    }
    
    // 随机选择一个
    const randomIndex = Math.floor(Math.random() * pool.length);
    const randomOp = pool[randomIndex];
    
    const formattedOp = {
        name: randomOp.干员,
        rarity: parseInt(randomOp.稀有度),
        profession: professionMap[randomOp.职业] || randomOp.职业,
        professionCn: randomOp.职业,
        subClass: randomOp.分支,
        avatar: `/icon/头像_${randomOp.干员}.png`,
        cost: 0
    };
    
    console.log(`[博弈抽取] 房间 ${hostKey} 抽取到: ${formattedOp.name}`);
    return formattedOp;
};

const server = http.createServer();          // 纯升级用，无 HTTP 业务
const wss = new WebSocket.Server({ server });

server.on('request', (req, res) => {
    // 1. CORS 预检 & 简单请求头（必须在所有响应前设置）
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // 2. 预检直接返回
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const { pathname } = url.parse(req.url, true);
    
    // QQ信息获取接口
    if (req.method === 'GET' && pathname.startsWith('/api/qq/')) {
        const qq = pathname.split('/').pop();
        console.log(`>>> [后端收到请求] 正在获取 QQ 信息: ${qq}`);
        
        // 验证QQ号格式
        if (!qq || !/^\d+$/.test(qq)) {
            console.log(`>>> [后端报错] 无效的QQ号格式: ${qq}`);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: '无效的QQ号格式' }));
            return;
        }
        
        // QQ头像链接（支持跨域）
        // 规格: 100(小), 640(大)
        const avatarUrl = `https://q1.qlogo.cn/g?b=qq&nk=${qq}&s=640`;
        
        // 尝试验证头像是否存在（简单的有效性检查）
        axios.get(avatarUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 3000,
            validateStatus: (status) => status < 500 // 接受 200-499 的状态码
        }).then(response => {
            console.log(`>>> [QQ获取] QQ号 ${qq} 头像获取成功`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                nickname: `QQ_${qq}`, // 默认昵称，用户可自行修改
                avatar: avatarUrl
            }));
        }).catch(error => {
            console.error(`>>> [后端报错] QQ头像获取失败: ${error.message}`);
            // 即使请求失败，也返回头像链接（因为可能是网络问题，但链接本身可能有效）
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                nickname: `QQ_${qq}`,
                avatar: avatarUrl,
                warning: '无法验证头像有效性，但已返回头像链接'
            }));
        });
        
        return;
    }
    
    // B站信息获取接口
    if (req.method === 'GET' && pathname.startsWith('/api/bilibili/')) {
        const uid = pathname.split('/').pop();
        console.log(`>>> [后端收到请求] 正在处理 UID: ${uid}`);
        
        // 验证UID格式
        if (!uid || !/^\d+$/.test(uid)) {
            console.log(`>>> [后端报错] 无效的UID格式: ${uid}`);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: '无效的UID格式' }));
            return;
        }
        
        // 1. 缓存检查
        if (biliCache.has(uid)) {
            console.log(`>>> [读取缓存] 直接返回 UID: ${uid}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, ...biliCache.get(uid) }));
            return;
        }
        
        // 2. 请求B站（设置3秒超时，防止无限等待）
        console.log(`>>> [发起外网请求] 正在连接 api.bilibili.com ... UID: ${uid}`);
        
        axios.get(`https://api.bilibili.com/x/space/acc/info?mid=${uid}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.bilibili.com/'
            },
            timeout: 3000 // 关键：设置3秒超时，防止无限等待
        }).then(response => {
            console.log(`>>> [B站响应] 状态码: ${response.status}`);
            console.log(`>>> [B站响应] 数据:`, JSON.stringify(response.data).substring(0, 200));
            
            if (response.data && response.data.code === 0) {
                const data = response.data.data;
                const userData = {
                    name: data.name,
                    avatar: data.face,
                    sign: data.sign
                };
                
                console.log(`>>> [获取成功] 用户: ${userData.name}`);
                
                // 3. 写入缓存
                biliCache.set(uid, userData);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, ...userData }));
            } else {
                const errorMsg = response.data?.message || 'B站未找到该用户';
                console.log(`>>> [B站返回错误]`, response.data);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: errorMsg }));
            }
        }).catch(error => {
            // 打印具体错误原因
            console.error(`>>> [后端报错] ${error.code || 'UNKNOWN'}: ${error.message}`);
            if (error.stack) {
                console.error(`>>> [错误堆栈]`, error.stack);
            }
            
            // 即使出错，也要给前端返回一个JSON，不能让前端一直转圈
            const errorMessage = error.code === 'ECONNABORTED' || error.message.includes('timeout') 
                ? '连接B站超时，请检查网络连接' 
                : `服务器网络错误: ${error.message}`;
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: false, 
                message: errorMessage
            }));
        });
        return;
    }
    
    // 新系统：创建房间并生成邀请链接
    if (req.method === 'POST' && pathname === '/api/create-room') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
            try {
                // 生成邀请key（8位随机字符串）
                const generateKey = () => {
                    return Math.random().toString(36).substring(2, 10);
                };
                
                const keys = {
                    HOST: generateKey(),
                    TEAM_A: generateKey(),
                    TEAM_B: generateKey(),
                    SPECTATOR: generateKey()
                };
                
                // 使用HOST key作为房间标识符
                const hostKey = keys.HOST;
                
                // 初始化房间
                rooms[hostKey] = { hosts: [], teamA: [], teamB: [], spectators: [] };
                
                // 存储所有key到hostKey的映射
                keyToRoomMap[keys.HOST] = hostKey;
                keyToRoomMap[keys.TEAM_A] = hostKey;
                keyToRoomMap[keys.TEAM_B] = hostKey;
                keyToRoomMap[keys.SPECTATOR] = hostKey;
                
                console.log(`[创建房间] Host Key: ${hostKey}, Keys:`, keys);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true,
                    keys: keys
                }));
            } catch (e) {
                console.error('[创建房间] 错误:', e);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: '创建房间失败' }));
            }
        });
        return;
    }
    
    // 旧系统兼容：create-room
    if (req.method === 'POST' && pathname === '/create-room') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
            try {
                const { roomId, ownerId, team1Id, team2Id, viewerId } = JSON.parse(body);
                shareMap.set(ownerId, { roomId, type: 'owner' });
                shareMap.set(team1Id, { roomId, type: 'team1' });
                shareMap.set(team2Id, { roomId, type: 'team2' });
                shareMap.set(viewerId, { roomId, type: 'viewer' });
                roomMap.set(roomId, new Set())
                console.log(`[create-room] ${Date.now()} owner=${ownerId} room=${roomId}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            } catch (e) {
                res.writeHead(400);
                res.end('bad json');
            }
        });
        return;
    }
});


// 辅助函数：根据socketId找到用户所在的房间和角色
const findUserInRoom = (socketId) => {
    for (const hostKey in rooms) {
        const room = rooms[hostKey];
        for (const role of ['hosts', 'teamA', 'teamB', 'spectators']) {
            const index = room[role].findIndex(u => u.socketId === socketId);
            if (index !== -1) return { hostKey, role, index, user: room[role][index] };
        }
    }
    return null;
};

// 获取房间内所有连接
const getRoomConnections = (hostKey) => {
    const connections = [];
    for (const userId of userMap.keys()) {
        const user = userMap.get(userId);
        if (user && user.hostKey === hostKey && user.client && user.client.readyState === WebSocket.OPEN) {
            connections.push(user.client);
        }
    }
    return connections;
};

// 辅助函数：广播终止状态更新
const broadcastTerminationUpdate = (hostKey) => {
    const state = gameStates[hostKey];
    if (!state) return;
    
    const updateMsg = JSON.stringify({
        type: 'termination_update',
        teamA: state.teamATerminated,
        teamB: state.teamBTerminated
    });
    
    getRoomConnections(hostKey).forEach((client) => {
        try {
            client.send(updateMsg);
        } catch (error) {
            console.error(`[终止状态更新] 广播失败:`, error);
        }
    });
};

// 辅助函数：检查是否双方都已操作，触发倒计时加速
const checkFastForward = (hostKey) => {
    const state = gameStates[hostKey];
    if (!state || !state.isBidding) return;
    
    // 检查A队是否已操作 (已终止 或 已提交动作)
    const aReady = state.teamATerminated || (state.teamAAction && state.teamAAction.type);
    // 检查B队是否已操作
    const bReady = state.teamBTerminated || (state.teamBAction && state.teamBAction.type);
    
    if (aReady && bReady) {
        // 双方都已就绪
        if (state.biddingTimeLeft > 5) {
            console.log(`[加速] 双方都已操作，倒计时从 ${state.biddingTimeLeft.toFixed(1)}s 跳变至 5s`);
            state.biddingTimeLeft = 5;
            // 立即广播一次时间更新，让前端UI立刻响应
            const progressMsg = JSON.stringify({
                type: 'bidding_countdown',
                timeLeft: 5,
                progress: (5 / 25) * 100
            });
            getRoomConnections(hostKey).forEach(c => {
                try { c.send(progressMsg); } catch(e){}
            });
        }
    }
};

// 辅助函数：判断单边模式是否对某队生效（只有在对手于【之前】的回合终止时才生效）
const isSingleSideModeActiveFor = (state, myTeam, opponentTerminated, opponentTerminatedRound) => {
    // 如果对手没终止，当然不是单边模式
    if (!opponentTerminated) return false;
    // 如果对手终止回合数未记录，无法判断
    if (opponentTerminatedRound === null) return false;
    // 关键：只有当对手终止的回合 < 当前回合，才算单边模式生效
    // (例如：对手在第1回合终止，现在是第2回合，1 < 2，生效)
    // 如果对手终止回合 === 当前回合，说明是当前回合终止的，不算单边模式
    return opponentTerminatedRound < state.currentRound;
};

// 博弈阶段结算函数
const resolveBiddingRound = (hostKey) => {
    const state = gameStates[hostKey];
    if (!state || !state.currentBiddingOp) return;
    
    // 确保终止状态已初始化
    if (state.teamATerminated === undefined) state.teamATerminated = false;
    if (state.teamBTerminated === undefined) state.teamBTerminated = false;
    if (state.teamATerminatedRound === undefined) state.teamATerminatedRound = null;
    if (state.teamBTerminatedRound === undefined) state.teamBTerminatedRound = null;
    
    // 获取双方操作
    let actA = null;
    let actB = null;
    
    // 确保资源已初始化
    if (!state.teamAResources) state.teamAResources = { cp: 50, ip: 1 };
    if (!state.teamBResources) state.teamBResources = { cp: 50, ip: 1 };
    
    // --- A队 动作判定 ---
    if (state.teamATerminated) {
        // 已终止方：无事发生
        actA = { type: 'TERMINATED', bid: 0, usedIntel: false };
        console.log(`[结算] A队已终止，无事发生`);
    } else if (state.teamAAction.type) {
        // 玩家有手动操作 (BID/REST/TERMINATE)，直接使用
        // 注意：如果是在单边模式下选择了休息，后端会在结算时拒绝（但前端应该已经禁用了）
        actA = state.teamAAction;
    } else if (state.teamAPreBid) {
        // 【新增】玩家只点击了价位，没有点击主要按钮，使用预选档位自动出价
        // 检查钱够不够
        if (state.teamAResources.cp >= state.teamAPreBid) {
            actA = { type: 'BID', bid: state.teamAPreBid, usedIntel: false };
            console.log(`[结算] A队超时，使用预选档位 ${state.teamAPreBid} 自动出价`);
        } else {
            // 钱不够，按休息处理
            actA = { type: 'REST', bid: 0, usedIntel: false };
            console.log(`[结算] A队预选档位 ${state.teamAPreBid} 但CP不足，默认为休息`);
        }
    } else {
        // 玩家【未操作】 (超时)
        const isSSM = isSingleSideModeActiveFor(state, 'A', state.teamBTerminated, state.teamBTerminatedRound);
        
        if (isSSM) {
            // 单边模式下超时：强制出价 10，如果钱不够则自动终止
            if (state.teamAResources.cp >= 10) {
                actA = { type: 'BID', bid: 10, usedIntel: false };
                console.log(`[结算] A队单边模式超时，强制出价 10（B队在回合 ${state.teamBTerminatedRound} 终止）`);
            } else {
                // CP不足10，自动终止
                actA = { type: 'TERMINATED', bid: 0, usedIntel: false };
                state.teamATerminated = true; // 更新状态
                state.teamATerminatedRound = state.currentRound; // 记录回合
                console.log(`[结算] A队单边模式超时且CP不足10，自动终止`);
                
                // 广播终止状态，确保前端更新
                broadcastTerminationUpdate(hostKey);
            }
        } else {
            // 正常模式/终止当回合超时：默认为休息
            actA = { type: 'REST', bid: 0, usedIntel: false };
            console.log(`[结算] A队未操作，默认为休息`);
        }
    }
    
    // --- B队 动作判定 (逻辑同上) ---
    if (state.teamBTerminated) {
        // 已终止方：无事发生
        actB = { type: 'TERMINATED', bid: 0, usedIntel: false };
        console.log(`[结算] B队已终止，无事发生`);
    } else if (state.teamBAction.type) {
        // 玩家有手动操作 (BID/REST/TERMINATE)，直接使用
        actB = state.teamBAction;
    } else if (state.teamBPreBid) {
        // 【新增】玩家只点击了价位，没有点击主要按钮，使用预选档位自动出价
        // 检查钱够不够
        if (state.teamBResources.cp >= state.teamBPreBid) {
            actB = { type: 'BID', bid: state.teamBPreBid, usedIntel: false };
            console.log(`[结算] B队超时，使用预选档位 ${state.teamBPreBid} 自动出价`);
        } else {
            // 钱不够，按休息处理
            actB = { type: 'REST', bid: 0, usedIntel: false };
            console.log(`[结算] B队预选档位 ${state.teamBPreBid} 但CP不足，默认为休息`);
        }
    } else {
        // 玩家【未操作】 (超时)
        const isSSM = isSingleSideModeActiveFor(state, 'B', state.teamATerminated, state.teamATerminatedRound);
        
        if (isSSM) {
            // 单边模式下超时：强制出价 10，如果钱不够则自动终止
            if (state.teamBResources.cp >= 10) {
                actB = { type: 'BID', bid: 10, usedIntel: false };
                console.log(`[结算] B队单边模式超时，强制出价 10（A队在回合 ${state.teamATerminatedRound} 终止）`);
            } else {
                // CP不足10，自动终止
                actB = { type: 'TERMINATED', bid: 0, usedIntel: false };
                state.teamBTerminated = true; // 更新状态
                state.teamBTerminatedRound = state.currentRound; // 记录回合
                console.log(`[结算] B队单边模式超时且CP不足10，自动终止`);
                
                // 广播终止状态，确保前端更新
                broadcastTerminationUpdate(hostKey);
            }
        } else {
            // 正常模式/终止当回合超时：默认为休息
            actB = { type: 'REST', bid: 0, usedIntel: false };
            console.log(`[结算] B队未操作，默认为休息`);
        }
    }
    
    // 【关键修复】资源结算
    // A队
    if (actA.type === 'BID') {
        // 博弈抓取：扣除CP
        state.teamAResources.cp -= actA.bid;
    } else if (actA.type === 'REST') {
        // 休息：恢复5CP，如果没买情报则恢复1IP
        state.teamAResources.cp += 5;
        if (!actA.usedIntel) {
            state.teamAResources.ip += 1;
        }
    }
    // actA.type === 'TERMINATED' -> 什么都不做（终止方不加不减）
    
    // B队
    if (actB.type === 'BID') {
        // 博弈抓取：扣除CP
        state.teamBResources.cp -= actB.bid;
    } else if (actB.type === 'REST') {
        // 休息：恢复5CP，如果没买情报则恢复1IP
        state.teamBResources.cp += 5;
        if (!actB.usedIntel) {
            state.teamBResources.ip += 1;
        }
    }
    // actB.type === 'TERMINATED' -> 什么都不做（终止方不加不减）
    
    // 【修复】检查本回合结束后是否双方都已终止
    // 注意：这里要用最新的 state.teamATerminated (因为上面可能触发了自动终止)
    const finalBothTerminated = state.teamATerminated && state.teamBTerminated;
    
    // 如果双方都终止了
    if (finalBothTerminated) {
        console.log('[结算] 双方都已终止，干员返回有效干员池');
        
        // 【新增】如果当前干员在 takenOperators 中，将其移除（真正返回池子）
        if (state.currentBiddingOp && state.takenOperators && state.takenOperators.has(state.currentBiddingOp.name)) {
            state.takenOperators.delete(state.currentBiddingOp.name);
            console.log(`[结算] 已将干员 ${state.currentBiddingOp.name} 从占用列表中移除，返回有效干员池`);
        }
        
        // 1. 设置胜负为无 (不分配干员，不触发熔断)
        const winner = 'NONE';
        
        // 2. 停止博弈循环
        if (state.biddingTimer) {
            clearInterval(state.biddingTimer);
            state.biddingTimer = null;
        }
        state.isBidding = false;
        state.gamePhase = 'WAITING'; // 切换到等待阶段
        
        // 3. 广播结算结果 (让前端播完动画)
        // 注意：type 设置为 bidding_resolve，但 winner 是 NONE
        const resultMsg = JSON.stringify({
            type: 'bidding_resolve',
            winner: 'NONE', // 前端需要处理 NONE 的情况（不做飞行动画，直接淡出）
            winCost: 0,
            operator: state.currentBiddingOp,
            teamAAction: actA,
            teamBAction: actB,
            teamAResources: { ...state.teamAResources },
            teamBResources: { ...state.teamBResources },
            teamAIntel: state.teamAIntel,
            teamBIntel: state.teamBIntel,
            // 【新增】告诉前端比赛彻底结束了
            isMatchEnded: true
        });
        
        getRoomConnections(hostKey).forEach((client) => {
            try {
                client.send(resultMsg);
            } catch (error) {
                console.error(`[博弈结算] 广播失败:`, error);
            }
        });
        
        // 4. 延迟后广播【全部终止】状态，强行刷新主持人UI
        // 【关键修复】确保数据安全，防止因数据缺失导致 JSON 序列化失败而中断广播
        setTimeout(() => {
            // 确保数据存在，防止报错中断
            const safeBannedMap = state.bannedMap || {};
            const safeTakenOps = state.takenOperators ? Array.from(state.takenOperators) : [];
            
            console.log('[全部终止] 准备广播 all_terminated 消息，禁用池状态:', {
                bannedMapSize: Object.keys(safeBannedMap).length,
                takenOpsSize: safeTakenOps.length
            });
            
            const allTerminatedMsg = JSON.stringify({
                type: 'all_terminated',
                phase: 'WAITING',
                bannedMap: safeBannedMap,
                takenOperators: safeTakenOps,
                // 关键：必须把双方终止状态发过去，确保前端 computed 属性生效
                teamATerminated: true,
                teamBTerminated: true
            });
            
            getRoomConnections(hostKey).forEach((client) => {
                try {
                    client.send(allTerminatedMsg);
                    console.log('[全部终止] 已发送 all_terminated 消息给客户端');
                } catch (error) {
                    console.error(`[全部终止] 广播失败:`, error);
                }
            });
        }, 2500); // 等待结算动画播放完毕
        
        // 重置操作状态
        state.currentBiddingOp = null;
        state.teamAAction = { type: null, bid: 0, usedIntel: false };
        state.teamBAction = { type: null, bid: 0, usedIntel: false };
        state.teamAIntel = false;
        state.teamBIntel = false;
        state.teamAPreBid = null;
        state.teamBPreBid = null;
        
        return; // 结束函数，不再执行后续的普通结算
    }
    
    // 胜负判定（考虑终止状态）
    let winner = 'DRAW';
    let winCost = 0;
    
    // 如果一方已终止，另一方自动获胜（如果出价）
    if (actA.type === 'TERMINATED' && actB.type === 'BID') {
        winner = 'B';
        winCost = actB.bid;
    } else if (actB.type === 'TERMINATED' && actA.type === 'BID') {
        winner = 'A';
        winCost = actA.bid;
    } else if (actA.type === 'BID' && actB.type === 'REST') {
        winner = 'A';
        winCost = actA.bid;
    } else if (actA.type === 'REST' && actB.type === 'BID') {
        winner = 'B';
        winCost = actB.bid;
    } else if (actA.type === 'BID' && actB.type === 'BID') {
        if (actA.bid > actB.bid) {
            winner = 'A';
            winCost = actA.bid;
        } else if (actB.bid > actA.bid) {
            winner = 'B';
            winCost = actB.bid;
        }
        // 如果出价相同，则为平局
    }
    // 如果双方都休息，或一方终止另一方休息，都是平局（不获取干员）
    
    // 正常结算：分配干员或处理平局
    if (winner !== 'DRAW') {
        // 标记干员已被占用（如果获胜），并添加到获胜队伍的列表中
        if (!state.takenOperators) {
            state.takenOperators = new Set();
        }
        state.takenOperators.add(state.currentBiddingOp.name);
        
        // 将获胜的干员添加到对应队伍的列表中
        if (!state.teamAOperators) state.teamAOperators = [];
        if (!state.teamBOperators) state.teamBOperators = [];
        
        const operatorData = {
            name: state.currentBiddingOp.name,
            rarity: state.currentBiddingOp.rarity,
            profession: state.currentBiddingOp.profession,
            professionCn: state.currentBiddingOp.professionCn,
            subClass: state.currentBiddingOp.subClass,
            avatar: state.currentBiddingOp.avatar,
            cost: 0,
            // 【新增】持久化存储：记录这张牌被对手看过（基于当轮对手是否买情报）
            // 如果 A 赢了，对手是 B，记录 B 是否买了情报
            // 如果 B 赢了，对手是 A，记录 A 是否买了情报
            revealedToOpponent: (winner === 'A') ? state.teamBIntel : state.teamAIntel
        };
        
        if (winner === 'A') {
            state.teamAOperators.push(operatorData);
            console.log(`[结算] 已将干员 ${operatorData.name} 添加到A队列表 (对手是否已知: ${operatorData.revealedToOpponent})`);
        } else if (winner === 'B') {
            state.teamBOperators.push(operatorData);
            console.log(`[结算] 已将干员 ${operatorData.name} 添加到B队列表 (对手是否已知: ${operatorData.revealedToOpponent})`);
        }
    } else {
        // 平局处理
        // 【特殊逻辑】单边模式下，如果未终止方自动终止（CP不足），该干员返回有效干员池，不执行熔断
        const isSingleSideModeWithAutoTerminate = 
            (actA.type === 'TERMINATED' && actB.type === 'TERMINATED' && 
             state.teamATerminatedRound === state.currentRound && state.teamBTerminatedRound === state.currentRound);
        
        if (isSingleSideModeWithAutoTerminate) {
            // 单边模式下双方都自动终止：干员返回池子，不执行熔断
            console.log(`[结算] 单边模式下双方都自动终止，干员 ${state.currentBiddingOp.name} 返回有效干员池`);
            // 不执行任何禁用操作，干员会保留在池子中，可以在后续轮次被抽取
        } else {
            // 其他平局情况（双方休息、双方NO_ACTION等）：执行熔断，禁用该干员及其同分支所有干员
            const op = state.currentBiddingOp;
            const subClass = op.subClass;
            const professionCn = op.professionCn || op.profession; // 使用已有的 professionCn，如果没有则使用 profession
            
            // 1. 更新 bannedBranches (用于抽卡过滤)
            if (!state.bannedBranches) {
                state.bannedBranches = new Set();
            }
            state.bannedBranches.add(subClass);
            
            // 2. 【重要修复】更新 bannedMap (用于前端展示)
            if (!state.bannedMap) state.bannedMap = {};
            
            // 如果该分支还不在 map 中，需要添加
            if (!state.bannedMap[subClass]) {
                // 从全局 operatorsData 中筛选该分支的所有干员
                // 注意：operatorsData 使用中文键名 '干员'、'分支' 等
                const branchOps = operatorsData.filter(o => {
                    const opSubClass = o['分支'] || o.subClass;
                    return opSubClass === subClass;
                });
                
                // 构建前端需要的格式
                state.bannedMap[subClass] = {
                    professionCn: professionCn,
                    operators: branchOps.map(o => {
                        const opName = o['干员'] || o.name;
                        return {
                            name: opName,
                            avatar: `/icon/头像_${opName}.png`
                        };
                    })
                };
                
                console.log(`[结算] 平局熔断：已将分支 ${subClass} (${branchOps.length}名干员) 加入禁用池`);
            }
            
            // 3. 【重要修复】同时将这些干员加入 takenOperators (防止被再次单抽，虽然抽卡逻辑已经过滤了分支，但为了数据一致性)
            if (!state.takenOperators) state.takenOperators = new Set();
            operatorsData.filter(o => {
                const opSubClass = o['分支'] || o.subClass;
                return opSubClass === subClass;
            }).forEach(o => {
                const opName = o['干员'] || o.name;
                state.takenOperators.add(opName);
            });
            
            console.log(`[结算] 平局熔断：已将分支 ${subClass} 的所有干员加入 takenOperators`);
            
            // 4. 【重要修复】广播禁用池更新给所有客户端
            const banUpdateMsg = JSON.stringify({
                type: 'ban_pool_update',
                bannedMap: state.bannedMap,
                takenOperators: Array.from(state.takenOperators)
            });
            
            getRoomConnections(hostKey).forEach((client) => {
                try {
                    client.send(banUpdateMsg);
                } catch (error) {
                    console.error(`[结算] 广播禁用池更新失败:`, error);
                }
            });
            
            console.log(`[结算] 已广播禁用池更新，包含 ${Object.keys(state.bannedMap).length} 个分支`);
        }
    }
    
    // 【修复1】在结算后，立即广播最新的资源状态，确保前端收到资源变化
    const allConnections = getRoomConnections(hostKey);
    allConnections.forEach((client) => {
        try {
            client.send(JSON.stringify({
                type: 'update_resources',
                team: 'A',
                resources: state.teamAResources
            }));
            client.send(JSON.stringify({
                type: 'update_resources',
                team: 'B',
                resources: state.teamBResources
            }));
        } catch (error) {
            console.error(`[结算] 广播资源更新失败:`, error);
        }
    });
    
    // 构建详细的结果数据对象
    const resultData = {
        winner: winner, // 'A', 'B', 'DRAW', 'NONE'
        winCost: winCost,
        operator: state.currentBiddingOp,
        teamAAction: actA,
        teamBAction: actB,
        teamAIntel: state.teamAIntel, // A队是否买了情报
        teamBIntel: state.teamBIntel, // B队是否买了情报
        isTerminatedMatch: false // 这里不会是终止匹配（已在前面处理）
    };
    
    // 重置动作状态（准备下一轮）
    state.teamAAction = { type: null, bid: 0, usedIntel: false };
    state.teamBAction = { type: null, bid: 0, usedIntel: false };
    state.teamAIntel = false;
    state.teamBIntel = false;
    state.teamAPreBid = null;
    state.teamBPreBid = null;
    
    // 进入结果展示阶段（自动循环开始）
    startResultPhase(hostKey, resultData);
    
    return; // 结束函数，不再执行后续的等待阶段逻辑
    
    // 【已废弃】以下是旧的等待阶段逻辑，现在不再使用（保留作为参考）
    /*
    setTimeout(() => {
        // 【重要】再次检查双方是否都终止（防止在 setTimeout 期间状态变化）
        if (state.teamATerminated && state.teamBTerminated) {
            console.log('[结算] setTimeout期间检测到双方都已终止，立即结束博弈阶段');
            
            // 清理定时器（如果存在）
            if (state.biddingTimer) {
                clearInterval(state.biddingTimer);
                state.biddingTimer = null;
            }
            
            // 停止博弈
            state.isBidding = false;
            state.gamePhase = 'WAITING'; // 【修复】设置游戏阶段为等待阶段
            state.currentBiddingOp = null;
            state.teamAAction = { type: null, bid: 0, usedIntel: false };
            state.teamBAction = { type: null, bid: 0, usedIntel: false };
            state.teamAIntel = false;
            state.teamBIntel = false;
            state.teamAPreBid = null;
            state.teamBPreBid = null;
            
            // 立即广播进入等待阶段（包含禁用池状态）
            const allTerminatedMsg = JSON.stringify({
                type: 'all_terminated',
                phase: 'WAITING',
                bannedMap: state.bannedMap || {},
                takenOperators: Array.from(state.takenOperators || []),
                // 【修复】必须把双方终止状态发过去，确保前端按钮显示
                teamATerminated: true,
                teamBTerminated: true
            });
            getRoomConnections(hostKey).forEach((client) => {
                try {
                    client.send(allTerminatedMsg);
                } catch (error) {
                    console.error(`[全部终止] 广播失败:`, error);
                }
            });
            
            return; // 结束处理，不执行后续的等待阶段重置
        }
        
        state.isBidding = false;
        state.currentBiddingOp = null;
        state.teamAAction = { type: null, bid: 0, usedIntel: false };
        state.teamBAction = { type: null, bid: 0, usedIntel: false };
        state.teamAIntel = false;
        state.teamBIntel = false;
        state.teamAPreBid = null;
        state.teamBPreBid = null;
        
        // 广播回到等待阶段
        const waitingMsg = JSON.stringify({
            type: 'bidding_waiting',
            round: state.currentRound
        });
        
        getRoomConnections(hostKey).forEach((client) => {
            try {
                client.send(waitingMsg);
            } catch (error) {
                console.error(`[等待阶段] 广播失败:`, error);
            }
        });
    }, 2000); // 等待动画播放完成
    */
};

// =======================================================
// 核心逻辑重构区：博弈阶段全自动化
// =======================================================

// 辅助函数：启动博弈回合 (Start Bidding Phase)
// 从 start_bidding 消息处理中提取，用于自动循环
const startBiddingPhase = (hostKey) => {
    const state = gameStates[hostKey];
    if (!state) return;

    // 检查是否双方都已终止
    if (state.teamATerminated && state.teamBTerminated) {
        console.log(`[自动循环] 双方都已终止，停止自动循环`);
        // 广播全部终止状态
        const allTerminatedMsg = JSON.stringify({
            type: 'all_terminated',
            phase: 'WAITING',
            bannedMap: state.bannedMap || {},
            takenOperators: Array.from(state.takenOperators || []),
            teamATerminated: true,
            teamBTerminated: true
        });
        getRoomConnections(hostKey).forEach(c => { 
            try { 
                c.send(allTerminatedMsg); 
            } catch(e){
                console.error(`[自动循环] 广播失败:`, e);
            }
        });
        return;
    }

    // 【修复回合数逻辑】CORRECT LOGIC:
    // If it IS the first round (which it is on initial start), do NOT increment.
    // If it is NOT the first round (subsequent loops), DO increment.
    if (!state.isFirstRound) {
        state.currentRound += 1;
        console.log(`[自动循环] 轮次已更新为: ${state.currentRound}`);
    } else {
        // Crucial: If it IS the first round, we just unset the flag for NEXT time.
        // We do NOT increment currentRound (it stays at 1).
        console.log(`[自动循环] 第一轮博弈开始，轮次保持: ${state.currentRound}`);
    }
    state.isFirstRound = false; // 标记不再是第一轮（为下次循环准备）

    console.log(`[自动循环] 启动第 ${state.currentRound} 回合博弈`);

    // 抽取干员
    const newOp = drawOneOperator(hostKey);
    if (!newOp) {
        console.log(`[自动循环] 池子已空，停止`);
        // 可以广播一个消息通知前端
        return;
    }

    // 初始化博弈状态
    state.gamePhase = 'BIDDING_ANIMATION'; // 先进入动画阶段
    state.currentBiddingOp = newOp;
    state.teamAAction = { type: null, bid: 0, usedIntel: false };
    state.teamBAction = { type: null, bid: 0, usedIntel: false };
    state.teamAIntel = false;
    state.teamBIntel = false;
    state.teamAPreBid = null;
    state.teamBPreBid = null;
    state.biddingTimeLeft = 25;
    state.timerType = 'ANIMATION'; // 标记当前计时器类型

    // 广播动画开始
    const animationMsg = JSON.stringify({
        type: 'bidding_animation_start',
        round: state.currentRound,
        operator: newOp
    });
    getRoomConnections(hostKey).forEach(c => { 
        try { 
            c.send(animationMsg); 
        } catch(e){
            console.error(`[自动循环] 广播动画失败:`, e);
        }
    });

    // 4秒后正式开始博弈倒计时
    setTimeout(() => {
        state.gamePhase = 'BIDDING';
        state.isBidding = true;
        state.biddingTimeLeft = 25; // 25秒倒计时
        state.timerType = 'BIDDING';

        // 计算单边模式
        const isSingleSideModeA = state.teamBTerminated && state.teamBTerminatedRound !== null && state.teamBTerminatedRound < state.currentRound;
        const isSingleSideModeB = state.teamATerminated && state.teamATerminatedRound !== null && state.teamATerminatedRound < state.currentRound;

        // 清理之前的定时器
        if (state.biddingTimer) clearInterval(state.biddingTimer);
        if (state.activeTimer) clearInterval(state.activeTimer);

        // 启动博弈定时器（使用 biddingTimer）
        state.biddingTimer = setInterval(() => {
            if (state.isPaused) return;

            state.biddingTimeLeft -= 0.1;
            
            // 广播倒计时进度
            const progressMsg = JSON.stringify({
                type: 'bidding_countdown',
                timeLeft: state.biddingTimeLeft,
                progress: (state.biddingTimeLeft / 25) * 100,
                phase: 'BIDDING'
            });
            getRoomConnections(hostKey).forEach(c => { 
                try { 
                    c.send(progressMsg); 
                } catch(e){
                    console.error(`[自动循环] 广播倒计时失败:`, e);
                }
            });
            
            if (state.biddingTimeLeft <= 0) {
                clearInterval(state.biddingTimer);
                state.biddingTimer = null;
                resolveBiddingRound(hostKey); // 触发结算
            }
        }, 100);

        // 广播博弈开始
        const biddingMsg = JSON.stringify({
            type: 'bidding_start',
            round: state.currentRound,
            operator: newOp,
            timeLeft: 25,
            isSingleSideModeA,
            isSingleSideModeB
        });
        getRoomConnections(hostKey).forEach(c => { 
            try { 
                c.send(biddingMsg); 
            } catch(e){
                console.error(`[自动循环] 广播博弈开始失败:`, e);
            }
        });

    }, 4000);
};

// 辅助函数：启动结果展示阶段 (Result Show Phase - 10s)
const startResultPhase = (hostKey, resultData) => {
    const state = gameStates[hostKey];
    if (!state) return;

    state.gamePhase = 'RESULT_SHOW';
    state.timerType = 'RESULT';
    state.phaseTimeLeft = 5; // 5秒展示
    state.isBidding = false; // 结束博弈状态

    console.log(`[自动循环] 进入结果展示阶段 (5s)`);

    // 清理之前的定时器
    if (state.activeTimer) clearInterval(state.activeTimer);
    if (state.biddingTimer) {
        clearInterval(state.biddingTimer);
        state.biddingTimer = null;
    }

    // 广播结果展示消息
    const resultMsg = JSON.stringify({
        type: 'result_show_start',
        duration: 10,
        result: resultData, // 包含赢家、消耗、干员信息等
        teamAResources: state.teamAResources,
        teamBResources: state.teamBResources,
        currentRound: state.currentRound
    });
    getRoomConnections(hostKey).forEach(c => { 
        try { 
            c.send(resultMsg); 
        } catch(e){
            console.error(`[自动循环] 广播结果展示失败:`, e);
        }
    });

    // 启动结果展示定时器
    state.activeTimer = setInterval(() => {
        if (state.isPaused) return;

        state.phaseTimeLeft -= 0.1;
        
        // 【关键修改】在结果展示阶段，心跳包携带完整 resultData，作为冗余备份
        // 广播倒计时 (复用 bidding_countdown 消息类型以兼容前端进度条)
        const progressMsg = JSON.stringify({
            type: 'bidding_countdown',
            timeLeft: state.phaseTimeLeft,
            progress: (state.phaseTimeLeft / 5) * 100,
            phase: 'RESULT_SHOW',
            // 【新增】携带 resultData，防止 start 消息丢失导致前端显示 DATA SYNCING
            result: resultData
        });
        getRoomConnections(hostKey).forEach(c => { 
            try { 
                c.send(progressMsg); 
            } catch(e){
                console.error(`[自动循环] 广播结果展示倒计时失败:`, e);
            }
        });

        if (state.phaseTimeLeft <= 0) {
            clearInterval(state.activeTimer);
            state.activeTimer = null;
            startCooldownPhase(hostKey); // 进入冷却
        }
    }, 100);
};

// 辅助函数：启动冷却阶段 (Cooldown Phase - 5s)
const startCooldownPhase = (hostKey) => {
    const state = gameStates[hostKey];
    if (!state) return;

    state.gamePhase = 'COOLDOWN';
    state.timerType = 'COOLDOWN';
    state.phaseTimeLeft = 2; // 2秒冷却

    console.log(`[自动循环] 进入冷却阶段 (5s)`);

    // 清理之前的定时器
    if (state.activeTimer) clearInterval(state.activeTimer);

    // 广播冷却开始
    const cooldownMsg = JSON.stringify({
        type: 'cooldown_start',
        duration: 5
    });
    getRoomConnections(hostKey).forEach(c => { 
        try { 
            c.send(cooldownMsg); 
        } catch(e){
            console.error(`[自动循环] 广播冷却开始失败:`, e);
        }
    });

    // 启动冷却定时器
    state.activeTimer = setInterval(() => {
        if (state.isPaused) return;

        state.phaseTimeLeft -= 0.1;

        // 广播倒计时
        const progressMsg = JSON.stringify({
            type: 'bidding_countdown',
            timeLeft: state.phaseTimeLeft,
            progress: (state.phaseTimeLeft / 2) * 100,
            phase: 'COOLDOWN'
        });
        getRoomConnections(hostKey).forEach(c => { 
            try { 
                c.send(progressMsg); 
            } catch(e){
                console.error(`[自动循环] 广播冷却倒计时失败:`, e);
            }
        });

        if (state.phaseTimeLeft <= 0) {
            clearInterval(state.activeTimer);
            state.activeTimer = null;
            startBiddingPhase(hostKey); // 自动开始下一轮！
        }
    }, 100);
};

// 服务器端开局倒计时控制
const startOpeningCountdown = (hostKey) => {
    if (!gameStates[hostKey] || gameStates[hostKey].gamePhase !== 'OPENING_SHOW') {
        return;
    }
    
    // 如果已有倒计时在进行，先清除
    if (gameStates[hostKey].countdownTimer) {
        clearInterval(gameStates[hostKey].countdownTimer);
    }
    
    let timeLeft = 5000; // 5秒
    const interval = 100; // 每100ms更新一次
    
    const countdownTimer = setInterval(() => {
        timeLeft -= interval;
        const progress = Math.max(0, (timeLeft / 5000) * 100);
        
        // 广播倒计时进度
        const allConnections = getRoomConnections(hostKey);
        
        const progressMsg = JSON.stringify({
            type: 'opening_countdown',
            progress: progress,
            timeLeft: Math.max(0, timeLeft)
        });
        
        allConnections.forEach((client) => {
            try {
                client.send(progressMsg);
            } catch (error) {
                console.error(`[倒计时] 广播失败:`, error);
            }
        });
        
        if (timeLeft <= 0) {
            clearInterval(countdownTimer);
            gameStates[hostKey].countdownTimer = null;
            
            // 倒计时结束，通知客户端
            const allConnections2 = getRoomConnections(hostKey);
            const completeMsg = JSON.stringify({
                type: 'opening_countdown_complete'
            });
            
            allConnections2.forEach((client) => {
                try {
                    client.send(completeMsg);
                } catch (error) {
                    console.error(`[倒计时完成] 广播失败:`, error);
                }
            });
        }
    }, interval);
    
    // 存储定时器引用（用于清理）
    gameStates[hostKey].countdownTimer = countdownTimer;
};

// 广播房间数据给所有成员
const broadcastLobbyUpdate = (hostKey) => {
    if (!rooms[hostKey]) {
        console.log(`[广播] 房间 ${hostKey} 不存在`);
        return;
    }
    const roomData = rooms[hostKey];
    
    // 找到所有在这个房间的WebSocket连接
    const allConnections = [];
    for (const userId of userMap.keys()) {
        const user = userMap.get(userId);
        if (user && user.hostKey === hostKey && user.client && user.client.readyState === WebSocket.OPEN) {
            allConnections.push(user.client);
        }
    }
    
    // 广播给所有连接
    const msg = JSON.stringify({ 
        type: 'update_lobby', 
        data: roomData 
    });
    
    console.log(`[广播] 房间 ${hostKey} 更新，成员数: ${allConnections.length}，数据:`, JSON.stringify(roomData).substring(0, 200));
    
    allConnections.forEach(ws => {
        try {
            ws.send(msg);
        } catch (error) {
            console.error(`[广播] 发送失败:`, error);
        }
    });
};

wss.on('connection', (ws, req) => {
    const socketId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[连接] 新用户连接: ${socketId}, URL: ${req.url}`);
    
    let currentHostKey = null;
    let currentUserId = null;

    /* ---------- 1. 握手阶段解析 query ---------- */
    const params = new url.URL(req.url, `http://${req.headers.host}`).searchParams;
    const shareId = params.get('shareId'); // 用这个找到身份和房间号（旧系统）
    const userId = params.get('userId') || socketId; // 用这个标识客户端，如果没有则使用socketId

    console.log(`[连接] shareId: ${shareId}, userId: ${userId}`);

    // 支持两种连接方式：旧系统（shareId）和新系统（直接通过消息）
    if (shareId && shareMap.has(shareId)) {
        const roomId = shareMap.get(shareId).roomId;
        const type = shareMap.get(shareId).type;
        if (roomMap.has(roomId)) {
            userMap.set(userId, { roomId, client: ws, socketId, hostKey: null });
            roomMap.get(roomId).add(userId);
            ws.send(JSON.stringify({ type: type }));
        }
    } else {
        // 新系统：先保存连接，等待join_lobby消息
        console.log(`[连接] 新系统连接，等待join_lobby消息`);
        userMap.set(userId, {
            roomId: null,
            client: ws,
            socketId: socketId,
            hostKey: null
        });
    }

    /* ---------- 2. 广播函数（旧系统兼容） ---------- */
    const broadcast = (payload) => {
        if (!currentHostKey) return;
        const allConnections = [];
        for (const userId of userMap.keys()) {
            const user = userMap.get(userId);
            if (user && user.hostKey === currentHostKey && user.client && user.client.readyState === WebSocket.OPEN) {
                allConnections.push(user.client);
            }
        }
        const msg = JSON.stringify(payload);
        allConnections.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(msg);
            }
        });
    };

    /* ---------- 3. 处理消息 ---------- */
    ws.on('message', (data) => {
        let parsed;
        try { 
            parsed = JSON.parse(data); 
        } catch { 
            return; 
        }

        // 新系统：加入大厅
        if (parsed.action === 'join_lobby') {
            const { role, nickname, avatar, key } = parsed;
            currentUserId = userId || socketId;
            
            if (!key) {
                console.log(`[加入大厅] 缺少key参数`);
                ws.send(JSON.stringify({ 
                    type: 'error', 
                    message: '缺少邀请key' 
                }));
                return;
            }
            
            // 通过key找到对应的hostKey（房间标识）
            let hostKey = keyToRoomMap[key];
            
            // 如果是HOST，且房间不存在，则创建新房间
            if (role === 'HOST' && !hostKey) {
                hostKey = key; // HOST key就是房间标识
                rooms[hostKey] = { hosts: [], teamA: [], teamB: [], spectators: [] };
                keyToRoomMap[key] = hostKey;
                console.log(`[加入大厅] HOST创建新房间: ${hostKey}`);
            } else if (!hostKey) {
                // 非HOST用户，但key不存在于映射中，说明房间不存在或key无效
                console.log(`[加入大厅] 无效的key: ${key}`);
                    ws.send(JSON.stringify({ 
                        type: 'error', 
                        message: '无效的邀请链接' 
                    }));
                    return;
            }
            
            currentHostKey = hostKey;
            
            console.log(`[加入大厅] 用户 ${currentUserId} (socketId: ${socketId}) 加入房间 ${hostKey}, 角色: ${role}, 昵称: ${nickname}`);
            
            // 构建用户对象
            const newUser = {
                socketId: socketId,
                nickname: nickname || (role === 'HOST' ? 'Host' : `Doctor${Math.floor(Math.random() * 1000)}`),
                avatar: avatar || ''
            };
            
            // 根据角色加入对应数组
            let targetRole = 'spectators';
            if (role === 'HOST') targetRole = 'hosts';
            else if (role === 'TEAM_A') targetRole = 'teamA';
            else if (role === 'TEAM_B') targetRole = 'teamB';
            
            // 防止重复加入（先移除旧的）
            const existingIndex = rooms[hostKey][targetRole].findIndex(u => u.socketId === socketId);
            if (existingIndex !== -1) {
                rooms[hostKey][targetRole].splice(existingIndex, 1);
                console.log(`[加入大厅] 移除重复用户: ${socketId}`);
            }
            
            // 添加新用户
            rooms[hostKey][targetRole].push(newUser);
            console.log(`[加入大厅] 用户已添加到 ${targetRole}, 当前房间数据:`, JSON.stringify(rooms[hostKey]).substring(0, 300));
            
            // 更新userMap
            userMap.set(currentUserId, {
                roomId: null,
                client: ws,
                socketId: socketId,
                hostKey: hostKey
            });
            
            // 广播更新
            broadcastLobbyUpdate(hostKey);
            
            // 【新增】中途加入机制：如果比赛已经开始，立即发送当前状态快照给新加入的用户
            if (gameStates[hostKey]) {
                console.log(`[中途加入] 检测到房间 ${hostKey} 比赛正在进行，准备同步状态给用户 ${currentUserId}`);
                const state = gameStates[hostKey];
                
                // 构建快照 (结构必须与前端 generateGameSeed 生成的一致)
                // 注意：将 Set 转换为 Array 以便 JSON 传输
                const snapshot = {
                    gamePhase: state.gamePhase,
                    currentRound: state.currentRound,
                    isBidding: state.isBidding,
                    isFirstRound: state.isFirstRound,
                    
                    // 资源
                    teamAResources: state.teamAResources || { cp: 50, ip: 1 },
                    teamBResources: state.teamBResources || { cp: 50, ip: 1 },
                    
                    // 队伍背包
                    teamAOperators: state.teamAOperators || [],
                    teamBOperators: state.teamBOperators || [],
                    
                    // 禁用与占用
                    bannedBranches: Array.from(state.bannedBranches || []),
                    takenOperators: Array.from(state.takenOperators || []),
                    bannedMap: state.bannedMap || {},
                    
                    // 开局干员
                    openingOperators: state.openingOperators || [],
                    
                    // 终止状态
                    serverStates: {
                        teamATerminated: state.teamATerminated || false,
                        teamBTerminated: state.teamBTerminated || false
                    },
                    
                    // --- 额外的实时状态 (用于同步倒计时和当前干员) ---
                    // 这些字段在种子回溯中可能没有，但在实时重连中很重要
                    currentBiddingOp: state.currentBiddingOp,
                    biddingTimeLeft: state.biddingTimeLeft || 25,
                    
                    // 恢复单边模式所需的判定数据
                    teamATerminatedRound: state.teamATerminatedRound,
                    teamBTerminatedRound: state.teamBTerminatedRound,
                    
                    // 部署状态（如果存在）
                    teamADeployed: state.teamADeployed || [],
                    teamBDeployed: state.teamBDeployed || [],
                    
                    // 日志（可选，用于显示历史记录）
                    battleLogs: [] // 中途加入不恢复日志，避免信息过载
                };
                
                // 发送单播消息
                ws.send(JSON.stringify({
                    type: 'join_in_progress',
                    snapshot: snapshot
                }));
                console.log(`[中途加入] 快照已发送给用户 ${currentUserId}`);
            }
            
            return;
        }
        
        // 【新增】初始化比赛状态（主持人进入 MatchPage 时触发，用于支持开局前的中途加入）
        if (parsed.action === 'init_match_state') {
            console.log(`[初始化状态] 收到初始化请求，socketId: ${socketId}`);
            
            const userData = findUserInRoom(socketId);
            if (!userData || userData.role !== 'hosts') {
                console.log(`[初始化状态] 权限验证失败，已拒绝`);
                return;
            }
            
            const hostKey = userData.hostKey;
            console.log(`[初始化状态] 验证通过，主持人 ${socketId} 初始化状态，房间: ${hostKey}`);
            
            // 如果状态已存在，不重复初始化（避免覆盖已有状态）
            if (gameStates[hostKey]) {
                console.log(`[初始化状态] 房间 ${hostKey} 的状态已存在，跳过初始化`);
                return;
            }
            
            // 初始化基础状态（PRE_OPENING 阶段，不抽卡）
            gameStates[hostKey] = {
                gamePhase: 'PRE_OPENING', // 准备开局阶段
                currentRound: 1,
                isBidding: false,
                isFirstRound: true,
                openingOperators: [], // 开局干员为空，等待主持人点击"开局"后抽取
                countdownTimer: null,
                countdownValue: 10000,
                bannedBranches: new Set(),
                takenOperators: new Set(), // 全局共享，不会重置
                teamAAction: { type: null, bid: 0, usedIntel: false },
                teamBAction: { type: null, bid: 0, usedIntel: false },
                teamAIntel: false,
                teamBIntel: false,
                currentBiddingOp: null,
                biddingTimer: null,
                biddingTimeLeft: 25,
                // 初始化预选档位（用于超时自动出价）
                teamAPreBid: null,
                teamBPreBid: null,
                // 资源管理（初始值：50调用点，1情报点）
                teamAResources: { cp: 50, ip: 1 },
                teamBResources: { cp: 50, ip: 1 },
                // 终止状态
                teamATerminated: false,
                teamBTerminated: false,
                firstTerminatedTeam: null,
                teamATerminatedRound: null,
                teamBTerminatedRound: null,
                // 队伍干员列表
                teamAOperators: [],
                teamBOperators: [],
                // 禁用池映射（全局共享，不会重置）
                bannedMap: {},
                // 【新增】自动循环相关字段
                timerType: null,
                phaseTimeLeft: 0,
                activeTimer: null
            };
            
            console.log(`[初始化状态] 房间 ${hostKey} 状态已初始化，阶段: PRE_OPENING`);
            return;
        }
        
        // 新系统：开始博弈（主持人触发，广播给所有客户端）
        if (parsed.action === 'start_bidding') {
            console.log(`[开始博弈] 收到开始博弈请求，socketId: ${socketId}`);
            
            const userData = findUserInRoom(socketId);
            if (!userData || userData.role !== 'hosts') {
                console.log(`[开始博弈] 权限验证失败，已拒绝`);
                return;
            }
            
            const hostKey = userData.hostKey;
            console.log(`[开始博弈] 验证通过，主持人 ${socketId} 开始博弈，房间: ${hostKey}`);
            
            if (!gameStates[hostKey]) {
                console.log(`[开始博弈] 房间 ${hostKey} 的游戏状态不存在，初始化...`);
                // 初始化游戏状态
                // 【重要】禁用池（bannedMap 和 takenOperators）是全局共享的，不会在重新开始时被重置
                gameStates[hostKey] = {
                    gamePhase: 'WAITING',
                    currentRound: 1,
                    isBidding: false,
                    isFirstRound: true,
                    openingOperators: [],
                    countdownTimer: null,
                    countdownValue: 10000,
                    bannedBranches: new Set(),
                    takenOperators: new Set(), // 首次创建时初始化为空，后续不会重置
                    teamAAction: { type: null, bid: 0, usedIntel: false },
                    teamBAction: { type: null, bid: 0, usedIntel: false },
                    teamAIntel: false,
                    teamBIntel: false,
                    currentBiddingOp: null,
                    biddingTimer: null,
                    biddingTimeLeft: 25,
                    // 资源管理（初始值：50调用点，1情报点）
                    teamAResources: { cp: 50, ip: 1 },
                    teamBResources: { cp: 50, ip: 1 },
                    // 终止状态
                    teamATerminated: false,
                    teamBTerminated: false,
                    firstTerminatedTeam: null,
                    teamATerminatedRound: null,
                    teamBTerminatedRound: null,
                    // 队伍干员列表（用于禁用池逻辑验证）
                    teamAOperators: [],
                    teamBOperators: [],
                    // 禁用池映射（用于前端显示）- 全局共享，不会重置
                    bannedMap: {}, // 首次创建时初始化为空，后续不会重置
                    // 【新增】自动循环相关字段
                    timerType: null,
                    phaseTimeLeft: 0,
                    activeTimer: null
                };
            } else {
                // 【重要】如果状态已存在，确保禁用池相关状态已初始化，但不要重置它们
                if (!gameStates[hostKey].bannedMap) {
                    gameStates[hostKey].bannedMap = {};
                }
                if (!gameStates[hostKey].takenOperators) {
                    gameStates[hostKey].takenOperators = new Set();
                }
            }
            
            const state = gameStates[hostKey];
            
            // 如果已经在博弈中，不允许重复开始
            if (state.isBidding) {
                console.log(`[开始博弈] 房间 ${hostKey} 已在博弈中，拒绝重复开始`);
                return;
            }
            
            // 【重要修复】如果双方都终止了，不允许继续博弈
            if (state.teamATerminated && state.teamBTerminated) {
                console.log(`[开始博弈] 双方都已终止，不允许继续博弈，请先重新开局或重新开始博弈`);
                ws.send(JSON.stringify({
                    type: 'error',
                    message: '双方都已终止，请先重新开局或重新开始博弈'
                }));
                return;
            }
            
            // 【修复回合数问题】不要在这里自增轮次，startBiddingPhase 函数里已经有这个逻辑了
            // 如果在这里自增，会导致第一轮变成第二轮
            // startBiddingPhase 函数中的逻辑：
            //   if (!state.isFirstRound) { state.currentRound += 1; }
            //   state.isFirstRound = false;
            // 所以这里只需要确保状态正确，不要重复自增
            
            console.log(`[开始博弈] 房间 ${hostKey} 当前阶段: ${state.gamePhase}, 轮次: ${state.currentRound}, 是否第一轮: ${state.isFirstRound}`);
            
            // 调用新函数启动博弈回合（自动循环）
            // startBiddingPhase 会正确处理轮次自增
            startBiddingPhase(hostKey);
            
            return;
        }
        
        // 选手操作：购买情报
        // 选手操作：预选档位（仅选择价位，不提交主要按钮）
        if (parsed.action === 'select_amount') {
            const userData = findUserInRoom(socketId);
            if (!userData) return;
            
            const hostKey = userData.hostKey;
            const state = gameStates[hostKey];
            if (!state || !state.isBidding) return;
            
            // 已终止的队伍不能预选档位
            if (userData.role === 'teamA' && state.teamATerminated) return;
            if (userData.role === 'teamB' && state.teamBTerminated) return;
            
            const { amount } = parsed;
            if (!amount || amount < 0) return;
            
            // 记录预选档位
            if (userData.role === 'teamA') {
                state.teamAPreBid = amount;
                console.log(`[预选档位] A队预选了 ${amount} 点`);
            } else if (userData.role === 'teamB') {
                state.teamBPreBid = amount;
                console.log(`[预选档位] B队预选了 ${amount} 点`);
            }
            
            return;
        }
        
        if (parsed.action === 'buy_intel') {
            const userData = findUserInRoom(socketId);
            if (!userData) return;
            
            const hostKey = userData.hostKey;
            const state = gameStates[hostKey];
            if (!state || !state.isBidding) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: '当前不在博弈阶段，无法购买情报'
                }));
                return;
            }
            
            // 确保资源已初始化
            if (!state.teamAResources) state.teamAResources = { cp: 50, ip: 1 };
            if (!state.teamBResources) state.teamBResources = { cp: 50, ip: 1 };
            
            // 根据角色确定是哪个队伍
            let teamResources = null;
            let team = '';
            
            if (userData.role === 'teamA') {
                teamResources = state.teamAResources;
                team = 'A';
            } else if (userData.role === 'teamB') {
                teamResources = state.teamBResources;
                team = 'B';
            } else {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: '只有选手可以购买情报'
                }));
                return;
            }
            
            // 检查IP是否足够
            if (teamResources.ip < 1) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: '情报点不足，无法购买情报'
                }));
                return;
            }
            
            // 扣减IP
            teamResources.ip -= 1;
            state.teamAIntel = (team === 'A');
            state.teamBIntel = (team === 'B');
            
            if (team === 'A') {
                state.teamAAction.usedIntel = true;
            } else {
                state.teamBAction.usedIntel = true;
            }
            
            // 广播资源更新给所有客户端
            const allConnections = getRoomConnections(hostKey);
            allConnections.forEach((client) => {
                try {
                    client.send(JSON.stringify({
                        type: 'update_resources',
                        team: 'A',
                        resources: state.teamAResources
                    }));
                    client.send(JSON.stringify({
                        type: 'update_resources',
                        team: 'B',
                        resources: state.teamBResources
                    }));
                } catch (error) {
                    console.error(`[购买情报] 广播资源更新失败:`, error);
                }
            });
            
            // 构造消息
            const unlockMsg = JSON.stringify({
                type: 'intel_unlocked',
                team: team
            });
            
            // 1. 发送给购买者 (当前 ws)
            ws.send(unlockMsg);
            
            // 2. 【新增】发送给所有观众
            // 遍历 userMap，找到同房间且角色为 spectator 的用户
            const room = rooms[hostKey];
            if (room && room.spectators) {
                for (const spectator of room.spectators) {
                    // 通过 socketId 在 userMap 中查找对应的连接
                    for (const [userId, user] of userMap.entries()) {
                        if (user.socketId === spectator.socketId && 
                            user.hostKey === hostKey && 
                            user.client && 
                            user.client.readyState === WebSocket.OPEN) {
                            try {
                                user.client.send(unlockMsg);
                                console.log(`[购买情报] 已通知观众: ${spectator.socketId}`);
                            } catch (e) {
                                console.error(`[购买情报] 发送给观众失败:`, e);
                            }
                            break; // 找到后跳出内层循环
                        }
                    }
                }
            }
            
            console.log(`[购买情报] 已通知购买者及所有观众`);
            
            return;
        }
        
        // 选手操作：博弈抓取
        if (parsed.action === 'bid') {
            const userData = findUserInRoom(socketId);
            if (!userData) return;
            
            const hostKey = userData.hostKey;
            const state = gameStates[hostKey];
            if (!state || !state.isBidding) return;
            
            // 确保终止状态已初始化
            if (state.teamATerminated === undefined) state.teamATerminated = false;
            if (state.teamBTerminated === undefined) state.teamBTerminated = false;
            
            const { amount } = parsed;
            if (!amount || amount < 0) return;
            
            // 【修复】已终止的队伍不能出价，但单边模式限制只在结算时生效（不在当前回合限制）
            if (userData.role === 'teamA') {
                // 如果A队已终止，不允许出价
                if (state.teamATerminated) {
                    console.log(`[出价] 错误：已终止的队伍不能出价`);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: '已终止的队伍不能参与操作'
                    }));
                    return;
                }
                // 【修改】移除单边模式限制：即使B队已终止，A队在当前回合仍可自由出价
                // 单边模式限制将在结算时生效（下一回合）
            } else if (userData.role === 'teamB') {
                // 如果B队已终止，不允许出价
                if (state.teamBTerminated) {
                    console.log(`[出价] 错误：已终止的队伍不能出价`);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: '已终止的队伍不能参与操作'
                    }));
                    return;
                }
                // 【修改】移除单边模式限制：即使A队已终止，B队在当前回合仍可自由出价
                // 单边模式限制将在结算时生效（下一回合）
            }
            
            // 根据角色记录出价
            if (userData.role === 'teamA') {
                state.teamAAction = {
                    type: 'BID',
                    bid: amount,
                    usedIntel: state.teamAAction.usedIntel || false
                };
            } else if (userData.role === 'teamB') {
                state.teamBAction = {
                    type: 'BID',
                    bid: amount,
                    usedIntel: state.teamBAction.usedIntel || false
                };
            }
            
            // 确认消息
            ws.send(JSON.stringify({
                type: 'bid_confirmed',
                amount: amount
            }));
            
            // 广播状态播报（绿色闪烁）- 让所有人看到
            const team = userData.role === 'teamA' ? 'A' : 'B';
            const statusMsg = JSON.stringify({
                type: 'choice_status_flash',
                team: team,
                action: 'BID',
                amount: amount
            });
            getRoomConnections(hostKey).forEach((client) => {
                try {
                    client.send(statusMsg);
                } catch (error) {
                    console.error(`[状态播报] 广播失败:`, error);
                }
            });
            
            // 检查是否双方都已操作，触发倒计时加速
            checkFastForward(hostKey);
            
            return;
        }
        
        // 选手操作：休息
        if (parsed.action === 'rest') {
            const userData = findUserInRoom(socketId);
            if (!userData) return;
            
            const hostKey = userData.hostKey;
            const state = gameStates[hostKey];
            if (!state || !state.isBidding) return;
            
            // 确保终止状态已初始化
            if (state.teamATerminated === undefined) state.teamATerminated = false;
            if (state.teamBTerminated === undefined) state.teamBTerminated = false;
            
            // 【修复】单边模式下，未终止方不能休息
            // 【修改】已终止的队伍不能休息，但单边模式限制只在结算时生效（不在当前回合限制）
            if (userData.role === 'teamA') {
                // 如果A队已终止，不允许休息（终止方不参与操作）
                if (state.teamATerminated) {
                    console.log(`[休息] 错误：已终止的队伍不能休息`);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: '已终止的队伍不能参与操作'
                    }));
                    return;
                }
                // 【修改】移除单边模式限制：即使B队已终止，A队在当前回合仍可自由休息
                // 单边模式限制将在结算时生效（下一回合）
            } else if (userData.role === 'teamB') {
                // 如果B队已终止，也不允许休息（终止方不参与操作）
                if (state.teamBTerminated) {
                    console.log(`[休息] 错误：已终止的队伍不能休息`);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: '已终止的队伍不能参与操作'
                    }));
                    return;
                }
                // 【修改】移除单边模式限制：即使A队已终止，B队在当前回合仍可自由休息
                // 单边模式限制将在结算时生效（下一回合）
            }
            
            // 根据角色记录休息
            if (userData.role === 'teamA') {
                state.teamAAction = {
                    type: 'REST',
                    bid: 0,
                    usedIntel: state.teamAAction.usedIntel || false
                };
            } else if (userData.role === 'teamB') {
                state.teamBAction = {
                    type: 'REST',
                    bid: 0,
                    usedIntel: state.teamBAction.usedIntel || false
                };
            }
            
            // 确认消息
            ws.send(JSON.stringify({
                type: 'rest_confirmed'
            }));
            
            // 广播状态播报（绿色闪烁）- 让所有人看到
            const team = userData.role === 'teamA' ? 'A' : 'B';
            const statusMsg = JSON.stringify({
                type: 'choice_status_flash',
                team: team,
                action: 'REST'
            });
            getRoomConnections(hostKey).forEach((client) => {
                try {
                    client.send(statusMsg);
                } catch (error) {
                    console.error(`[状态播报] 广播失败:`, error);
                }
            });
            
            // 检查是否双方都已操作，触发倒计时加速
            checkFastForward(hostKey);
            
            return;
        }
        
        // 选手操作：终止（可以在博弈回合内进行）
        if (parsed.action === 'terminate') {
            const userData = findUserInRoom(socketId);
            if (!userData) return;
            
            const hostKey = userData.hostKey;
            const state = gameStates[hostKey];
            if (!state) return;
            
            // 【修改】终止可以在博弈回合内进行，也可以在等待阶段进行
            // 但必须是在博弈阶段或等待阶段（不能在其他阶段）
            if (state.gamePhase !== 'BIDDING' && state.gamePhase !== 'WAITING') {
                console.log(`[终止] 错误：当前阶段不能终止`);
                ws.send(JSON.stringify({
                    type: 'error',
                    message: '当前阶段不能终止'
                }));
                return;
            }
            
            // 确保终止状态已初始化
            if (state.teamATerminated === undefined) state.teamATerminated = false;
            if (state.teamBTerminated === undefined) state.teamBTerminated = false;
            
            // 如果已经终止，不允许重复终止
            if ((userData.role === 'teamA' && state.teamATerminated) ||
                (userData.role === 'teamB' && state.teamBTerminated)) {
                console.log(`[终止] 该队伍已经终止`);
                return;
            }
            
            // 标记终止，并记录第一个终止的队伍
            if (userData.role === 'teamA') {
                state.teamATerminated = true;
                if (!state.firstTerminatedTeam) {
                    state.firstTerminatedTeam = 'A';
                }
                // 【新增】记录终止发生的回合
                if (state.isBidding) {
                    state.teamATerminatedRound = state.currentRound;
                    state.teamAAction = { type: null, bid: 0, usedIntel: false };
                    console.log(`[终止] A队在博弈回合内终止，已清除其操作，终止回合: ${state.currentRound}`);
                } else {
                    // 在等待阶段终止，记录为当前回合（下一回合开始生效）
                    state.teamATerminatedRound = state.currentRound;
                }
            } else if (userData.role === 'teamB') {
                state.teamBTerminated = true;
                if (!state.firstTerminatedTeam) {
                    state.firstTerminatedTeam = 'B';
                }
                // 【新增】记录终止发生的回合
                if (state.isBidding) {
                    state.teamBTerminatedRound = state.currentRound;
                    state.teamBAction = { type: null, bid: 0, usedIntel: false };
                    console.log(`[终止] B队在博弈回合内终止，已清除其操作，终止回合: ${state.currentRound}`);
                } else {
                    // 在等待阶段终止，记录为当前回合（下一回合开始生效）
                    state.teamBTerminatedRound = state.currentRound;
                }
            }
            
            console.log(`[终止] 队伍${userData.role === 'teamA' ? 'A' : 'B'}已终止，当前状态: A=${state.teamATerminated}, B=${state.teamBTerminated}, 是否在博弈中: ${state.isBidding}`);
            
            // 广播终止状态更新
            const updateMsg = JSON.stringify({
                type: 'termination_update',
                teamA: state.teamATerminated,
                teamB: state.teamBTerminated
            });
            getRoomConnections(hostKey).forEach((client) => {
                try {
                    client.send(updateMsg);
                } catch (error) {
                    console.error(`[终止] 广播失败:`, error);
                }
            });
            
            // 广播状态播报（红色闪烁）- 让所有人看到
            const team = userData.role === 'teamA' ? 'A' : 'B';
            const statusMsg = JSON.stringify({
                type: 'terminate_status_flash',
                team: team
            });
            getRoomConnections(hostKey).forEach((client) => {
                try {
                    client.send(statusMsg);
                } catch (error) {
                    console.error(`[状态播报] 广播失败:`, error);
                }
            });
            
            // 【重要】如果是在博弈回合内终止，且双方都终止了，需要特殊处理
            if (state.isBidding && state.teamATerminated && state.teamBTerminated) {
                console.log(`[终止] 博弈回合内双方都已终止，该回合干员将返回池子`);
                // 注意：这里不立即结束博弈阶段，而是等待倒计时结束或结算时处理
                // 结算函数会检测双方都终止的情况，并让干员返回池子
                
                // 检查是否双方都已操作，触发倒计时加速（双方都终止也算双方都已操作）
                checkFastForward(hostKey);
            } else if (state.isBidding) {
                // 如果还在博弈中，检查是否双方都已操作，触发倒计时加速
                checkFastForward(hostKey);
            }
            
            // 如果双方都终止了（且不在博弈中），立即结束博弈阶段并跳转
            if (!state.isBidding && state.teamATerminated && state.teamBTerminated) {
                console.log(`[终止] 双方都已终止（等待阶段），立即结束博弈阶段`);
                
                // 【重要】确保禁用池状态已初始化且不会被重置
                if (!state.bannedMap) state.bannedMap = {};
                if (!state.takenOperators) state.takenOperators = new Set();
                
                // 调试：打印禁用池状态
                const bannedMapSize = Object.keys(state.bannedMap).length;
                const totalBannedOps = Object.values(state.bannedMap).reduce((sum, group) => sum + (group.operators?.length || 0), 0);
                console.log(`[终止] 博弈阶段结束时的禁用池状态：${bannedMapSize} 个分支，共 ${totalBannedOps} 名干员`);
                if (bannedMapSize > 0) {
                    console.log(`[终止] 禁用池内容:`, JSON.stringify(state.bannedMap, null, 2));
                }
                
                // 1. 清理定时器（如果存在）
                if (state.biddingTimer) {
                    clearInterval(state.biddingTimer);
                    state.biddingTimer = null;
                }
                
                // 2. 停止博弈
                state.isBidding = false;
                
                // 3. 广播进入等待阶段（包含禁用池状态）
                const allTerminatedMsg = JSON.stringify({
                    type: 'all_terminated',
                    phase: 'WAITING', // 直接进入等待阶段，跳过攻略准备阶段
                    // 【重要】发送当前的禁用池状态，确保前端显示正确
                    bannedMap: state.bannedMap,
                    takenOperators: Array.from(state.takenOperators),
                    // 【修复】必须把双方终止状态发过去，确保前端按钮显示
                    teamATerminated: true,
                    teamBTerminated: true
                });
                getRoomConnections(hostKey).forEach((client) => {
                    try {
                        client.send(allTerminatedMsg);
                    } catch (error) {
                        console.error(`[全部终止] 广播失败:`, error);
                    }
                });
                
                return; // 结束处理
            }
            
            // 如果只有一方终止，进入单边模式
            // 单边模式下：未终止方在博弈回合内不能休息，只能出价10点
            // 25s后如果未终止方未操作且CP>=10，强制出价10；如果CP<10，无事发生
            // 已终止方25s后无事发生（不是休息）
            if (state.isBidding) {
                console.log(`[终止] 单边模式激活：${state.teamATerminated ? 'A' : 'B'}队已终止`);
            }
            
            return;
        }
        
        // 旧系统兼容：开始倒计时（已废弃，保留兼容）
        if (parsed.action === 'start_countdown') {
            console.log(`[倒计时] 收到倒计时请求，socketId: ${socketId}`);
            
            // 验证是否是主持人
            const userData = findUserInRoom(socketId);
            console.log(`[倒计时] 查找用户结果:`, userData);
            
            if (!userData) {
                console.log(`[倒计时] 未找到用户 ${socketId} 的房间信息，已拒绝`);
                return;
            }
            
            if (userData.role !== 'hosts') {
                console.log(`[倒计时] 用户 ${socketId} 不是主持人（角色: ${userData.role}），已拒绝`);
                return;
            }
            
            const hostKey = userData.hostKey;
            console.log(`[倒计时] 验证通过，主持人 ${socketId} 开始倒计时，房间: ${hostKey}`);
            
            // 1. 广播倒计时开始消息给房间内所有客户端（前端只负责显示动画，不负责跳转）
            const allConnections = getRoomConnections(hostKey);
            
            const countdownMsg = JSON.stringify({
                type: 'start_countdown'
            });
            
            console.log(`[倒计时] 准备广播给 ${allConnections.length} 个客户端`);
            
            allConnections.forEach((client) => {
                try {
                    client.send(countdownMsg);
                } catch (error) {
                    console.error(`[倒计时] 广播失败:`, error);
                }
            });
            
            console.log(`[倒计时] 广播完成，开始服务端计时...`);
            
            // 2. 【新增】服务端控制绝对时间，5秒后广播进入比赛指令
            // 这样无论前端是否在后台，收到这条消息时都会强制跳转
            setTimeout(() => {
                console.log(`[倒计时] 时间到，广播进入比赛指令，房间: ${hostKey}`);
                
                const enterMsg = JSON.stringify({
                    type: 'enter_match_trigger', // 新的消息类型
                    timestamp: Date.now() // 发送服务器时间戳，供前端校准
                });
                
                const allConnections2 = getRoomConnections(hostKey);
                allConnections2.forEach((client) => {
                    try {
                        client.send(enterMsg);
                    } catch (error) {
                        console.error(`[跳转] 广播失败:`, error);
                    }
                });
                
                console.log(`[跳转] 已广播进入比赛指令给 ${allConnections2.length} 个客户端`);
            }, 5000); // 5秒倒计时
            
            return;((client, index) => {
                try {
                    client.send(countdownMsg);
                    console.log(`[倒计时] 已发送给客户端 ${index + 1}/${allConnections.length}`);
                } catch (error) {
                    console.error(`[倒计时] 广播失败 (客户端 ${index + 1}):`, error);
                }
            });
            
            console.log(`[倒计时] 广播完成，已发送给 ${allConnections.length} 个客户端`);
            return;
        }
        
        // 【新增】暂停游戏（仅主持人，仅在博弈阶段）
        if (parsed.action === 'pause_game') {
            console.log(`[暂停游戏] 收到暂停请求，socketId: ${socketId}`);
            
            const userData = findUserInRoom(socketId);
            if (!userData || userData.role !== 'hosts') {
                console.log(`[暂停游戏] 权限验证失败，已拒绝`);
                return;
            }
            
            const hostKey = userData.hostKey;
            const state = gameStates[hostKey];
            
            // 检查是否在可暂停的阶段
            const canPause = state.isBidding || 
                            state.gamePhase === 'RESULT_SHOW' || 
                            state.gamePhase === 'COOLDOWN';
            
            if (!canPause) {
                console.log(`[暂停游戏] 当前阶段不允许暂停`);
                return;
            }
            
            // 清除活动定时器（根据阶段选择对应的定时器）
            // 【修复问题3】清除定时器后设置为 null，以便继续时能检测到需要重新启动
            if (state.gamePhase === 'BIDDING' && state.biddingTimer) {
                clearInterval(state.biddingTimer);
                state.biddingTimer = null; // 设置为 null，继续时检测到会重新启动
            } else if ((state.gamePhase === 'RESULT_SHOW' || state.gamePhase === 'COOLDOWN') && state.activeTimer) {
                clearInterval(state.activeTimer);
                state.activeTimer = null; // 设置为 null，继续时检测到会重新启动
            }
            
            // 设置暂停状态
            state.isPaused = true;
            
            // 计算当前剩余时间
            let currentTime = 0;
            if (state.timerType === 'BIDDING') {
                currentTime = state.biddingTimeLeft;
            } else if (state.timerType === 'RESULT' || state.timerType === 'COOLDOWN') {
                currentTime = state.phaseTimeLeft;
            }
            
            console.log(`[暂停游戏] 游戏已暂停，房间: ${hostKey}，阶段: ${state.gamePhase}，剩余时间: ${currentTime}秒`);
            
            // 广播暂停消息（包含当前阶段和剩余时间）
            const pauseMsg = JSON.stringify({
                type: 'game_paused',
                phase: state.gamePhase,
                timeLeft: currentTime
            });
            
            getRoomConnections(hostKey).forEach((client) => {
                try {
                    client.send(pauseMsg);
                } catch (error) {
                    console.error(`[暂停游戏] 广播失败:`, error);
                }
            });
            
            return;
        }
        
        // 【新增】继续游戏（仅主持人，仅在暂停状态）
        if (parsed.action === 'resume_game') {
            console.log(`[继续游戏] 收到继续请求，socketId: ${socketId}`);
            
            const userData = findUserInRoom(socketId);
            if (!userData || userData.role !== 'hosts') {
                console.log(`[继续游戏] 权限验证失败，已拒绝`);
                return;
            }
            
            const hostKey = userData.hostKey;
            const state = gameStates[hostKey];
            
            if (!state || !state.isPaused) {
                console.log(`[继续游戏] 游戏未在暂停状态，无法继续`);
                return;
            }
            
            // 取消暂停状态
            state.isPaused = false;
            
            // 【修复问题3】检查定时器是否存在，如果不存在则重新启动
            // 因为暂停时可能清除了定时器，所以需要重新启动
            let needRestartTimer = false;
            
            if (state.gamePhase === 'BIDDING' && !state.biddingTimer) {
                needRestartTimer = true;
                console.log(`[继续游戏] 检测到 BIDDING 阶段定时器不存在，需要重新启动`);
            } else if ((state.gamePhase === 'RESULT_SHOW' || state.gamePhase === 'COOLDOWN') && !state.activeTimer) {
                needRestartTimer = true;
                console.log(`[继续游戏] 检测到 ${state.gamePhase} 阶段定时器不存在，需要重新启动`);
            }
            
            // 如果需要重新启动定时器
            if (needRestartTimer) {
                if (state.gamePhase === 'BIDDING') {
                    // 重新启动博弈倒计时
                    state.biddingTimer = setInterval(() => {
                        if (state.isPaused) return;
                        state.biddingTimeLeft -= 0.1;
                        // 广播倒计时
                        const progressMsg = JSON.stringify({
                            type: 'bidding_countdown',
                            timeLeft: state.biddingTimeLeft,
                            progress: (state.biddingTimeLeft / 25) * 100,
                            phase: 'BIDDING'
                        });
                        getRoomConnections(hostKey).forEach(c => {
                            try {
                                c.send(progressMsg);
                            } catch(e) {
                                console.error(`[继续游戏] 广播倒计时失败:`, e);
                            }
                        });
                        if (state.biddingTimeLeft <= 0) {
                            clearInterval(state.biddingTimer);
                            state.biddingTimer = null;
                            resolveBiddingRound(hostKey);
                        }
                    }, 100);
                    console.log(`[继续游戏] 已重新启动 BIDDING 阶段定时器`);
                } else if (state.gamePhase === 'RESULT_SHOW') {
                    // 重新启动结果展示倒计时
                    state.activeTimer = setInterval(() => {
                        if (state.isPaused) return;
                        state.phaseTimeLeft -= 0.1;
                        // 广播倒计时
                        const progressMsg = JSON.stringify({
                            type: 'bidding_countdown',
                            timeLeft: state.phaseTimeLeft,
                            progress: (state.phaseTimeLeft / 5) * 100,
                            phase: 'RESULT_SHOW'
                        });
                        getRoomConnections(hostKey).forEach(c => {
                            try {
                                c.send(progressMsg);
                            } catch(e) {
                                console.error(`[继续游戏] 广播倒计时失败:`, e);
                            }
                        });
                        if (state.phaseTimeLeft <= 0) {
                            clearInterval(state.activeTimer);
                            state.activeTimer = null;
                            startCooldownPhase(hostKey);
                        }
                    }, 100);
                    console.log(`[继续游戏] 已重新启动 RESULT_SHOW 阶段定时器`);
                } else if (state.gamePhase === 'COOLDOWN') {
                    // 重新启动冷却倒计时
                    state.activeTimer = setInterval(() => {
                        if (state.isPaused) return;
                        state.phaseTimeLeft -= 0.1;
                        // 广播倒计时
                        const progressMsg = JSON.stringify({
                            type: 'bidding_countdown',
                            timeLeft: state.phaseTimeLeft,
                            progress: (state.phaseTimeLeft / 2) * 100,
                            phase: 'COOLDOWN'
                        });
                        getRoomConnections(hostKey).forEach(c => {
                            try {
                                c.send(progressMsg);
                            } catch(e) {
                                console.error(`[继续游戏] 广播倒计时失败:`, e);
                            }
                        });
                        if (state.phaseTimeLeft <= 0) {
                            clearInterval(state.activeTimer);
                            state.activeTimer = null;
                            // 进入下一轮博弈
                            startBiddingPhase(hostKey);
                        }
                    }, 100);
                    console.log(`[继续游戏] 已重新启动 COOLDOWN 阶段定时器`);
                }
            }
            
            // 计算当前剩余时间
            let currentTime = 0;
            if (state.timerType === 'BIDDING') {
                currentTime = state.biddingTimeLeft;
            } else if (state.timerType === 'RESULT' || state.timerType === 'COOLDOWN') {
                currentTime = state.phaseTimeLeft;
            }
            
            // 计算进度
            let currentProgress = 100;
            if (state.gamePhase === 'BIDDING') {
                currentProgress = (currentTime / 25) * 100;
            } else if (state.gamePhase === 'RESULT_SHOW') {
                currentProgress = (currentTime / 5) * 100;
            } else if (state.gamePhase === 'COOLDOWN') {
                currentProgress = (currentTime / 2) * 100;
            }
            
            console.log(`[继续游戏] 游戏已继续，房间: ${hostKey}，阶段: ${state.gamePhase}，剩余时间: ${currentTime}秒`);
            
            // 广播继续消息（包含进度信息）
            const resumeMsg = JSON.stringify({
                type: 'game_resumed',
                phase: state.gamePhase,
                timeLeft: currentTime,
                progress: currentProgress
            });
            
            getRoomConnections(hostKey).forEach((client) => {
                try {
                    client.send(resumeMsg);
                } catch (error) {
                    console.error(`[继续游戏] 广播失败:`, error);
                }
            });
            
            return;
        }
        
        // 新系统：更新个人信息
        if (parsed.action === 'update_profile') {
            const { nickname, avatar } = parsed;
            console.log(`[更新信息] 收到更新请求, socketId: ${socketId}, nickname: ${nickname}, avatar: ${avatar}`);
            const data = findUserInRoom(socketId);
            if (data) {
                const { hostKey, role, index } = data;
                if (nickname !== undefined) rooms[hostKey][role][index].nickname = nickname;
                if (avatar !== undefined) rooms[hostKey][role][index].avatar = avatar;
                console.log(`[更新信息] 用户 ${socketId} 在房间 ${hostKey} 的 ${role}[${index}] 更新信息成功`);
                console.log(`[更新信息] 更新后的用户数据:`, rooms[hostKey][role][index]);
                broadcastLobbyUpdate(hostKey);
            } else {
                console.log(`[更新信息] 未找到用户 ${socketId} 的房间信息`);
            }
            return;
        }
        
        // 新系统：开始比赛（主持人触发，服务器抽取干员并控制流程）
        if (parsed.action === 'start_match') {
            console.log(`[开始比赛] 收到开始比赛请求，socketId: ${socketId}`);
            
            // 验证是否是主持人
            const userData = findUserInRoom(socketId);
            if (!userData || userData.role !== 'hosts') {
                console.log(`[开始比赛] 权限验证失败，已拒绝`);
                return;
            }
            
            const hostKey = userData.hostKey;
            console.log(`[开始比赛] 验证通过，主持人 ${socketId} 开始比赛，房间: ${hostKey}`);
            
            // 初始化游戏状态
            // 【重要】禁用池（bannedMap 和 takenOperators）是全局共享的，不会在重新开始时被重置
            if (!gameStates[hostKey]) {
                gameStates[hostKey] = {
                    gamePhase: 'OPENING',
                    currentRound: 1,
                    isBidding: false,
                    isFirstRound: true,
                    openingOperators: [],
                    countdownTimer: null,
                    countdownValue: 10000,
                    bannedBranches: new Set(),
                    takenOperators: new Set(), // 首次创建时初始化为空，后续不会重置
                    teamAAction: { type: null, bid: 0, usedIntel: false },
                    teamBAction: { type: null, bid: 0, usedIntel: false },
                    teamAIntel: false,
                    teamBIntel: false,
                    currentBiddingOp: null,
                    biddingTimer: null,
                    biddingTimeLeft: 25,
                    // 资源管理（初始值：50调用点，1情报点）
                    teamAResources: { cp: 50, ip: 1 },
                    teamBResources: { cp: 50, ip: 1 },
                    // 终止状态
                    teamATerminated: false,
                    teamBTerminated: false,
                    firstTerminatedTeam: null,
                    teamATerminatedRound: null,
                    teamBTerminatedRound: null,
                    // 攻略准备阶段
                    teamAStrategyOps: [],
                    teamBStrategyOps: [],
                    teamAStrategyConfirmed: false,
                    teamBStrategyConfirmed: false,
                    // 队伍干员列表（用于禁用池逻辑验证）
                    teamAOperators: [],
                    teamBOperators: [],
                    // 禁用池映射（用于前端显示）- 全局共享，不会重置
                    bannedMap: {}, // 首次创建时初始化为空，后续不会重置
                    // 【新增】自动循环相关字段
                    timerType: null,
                    phaseTimeLeft: 0,
                    activeTimer: null
                };
            } else {
                // 如果状态已存在，确保资源已初始化
                if (!gameStates[hostKey].teamAResources) {
                    gameStates[hostKey].teamAResources = { cp: 50, ip: 1 };
                }
                if (!gameStates[hostKey].teamBResources) {
                    gameStates[hostKey].teamBResources = { cp: 50, ip: 1 };
                }
                // 确保队伍干员列表已初始化
                if (!gameStates[hostKey].teamAOperators) {
                    gameStates[hostKey].teamAOperators = [];
                }
                if (!gameStates[hostKey].teamBOperators) {
                    gameStates[hostKey].teamBOperators = [];
                }
                // 【重要】禁用池映射只在不存在时初始化，如果已存在则保留（全局共享）
                if (!gameStates[hostKey].bannedMap) {
                    gameStates[hostKey].bannedMap = {};
                }
                // 【重要】takenOperators 只在不存在时初始化，如果已存在则保留（全局共享）
                if (!gameStates[hostKey].takenOperators) {
                    gameStates[hostKey].takenOperators = new Set();
                }
            }
            
            // 服务器抽取干员
            console.log(`[开始比赛] 检查干员数据: operatorsData.length = ${operatorsData ? operatorsData.length : 0}`);
            const openingOperators = drawOpeningOperators(gameStates[hostKey].bannedMap, gameStates[hostKey].takenOperators);
            // const openingOperators = drawOpeningOperators();
            console.log(`[开始比赛] 服务器抽取到 ${openingOperators.length} 名干员`);
            
            // 检查抽取结果
            if (!openingOperators || openingOperators.length === 0) {
                console.error(`[开始比赛] 错误：抽取失败，干员数据为空！`);
                console.error(`[开始比赛] operatorsData 状态:`, {
                    isArray: Array.isArray(operatorsData),
                    length: operatorsData ? operatorsData.length : 0,
                    firstItem: operatorsData && operatorsData.length > 0 ? operatorsData[0] : null
                });
                // 发送错误消息给所有客户端
                const allConnections = getRoomConnections(hostKey);
                const errorMsg = JSON.stringify({
                    type: 'error',
                    message: '抽取干员失败，请检查服务器日志。可能原因：干员数据未正确加载。'
                });
                allConnections.forEach((client) => {
                    try {
                        client.send(errorMsg);
                    } catch (error) {
                        console.error(`[开始比赛] 发送错误消息失败:`, error);
                    }
                });
                return;
            }
            
            // 更新游戏状态
            gameStates[hostKey].gamePhase = 'OPENING_SHOW';
            gameStates[hostKey].openingOperators = openingOperators;
            
            // 确保初始化博弈阶段所需的状态
            if (!gameStates[hostKey].bannedBranches) {
                gameStates[hostKey].bannedBranches = new Set();
            }
            // 【重要】takenOperators 只在不存在时初始化，如果已存在则保留（全局共享，不会重置）
            if (!gameStates[hostKey].takenOperators) {
                gameStates[hostKey].takenOperators = new Set();
            }
            
            // 初始化队伍干员列表，将开局干员添加到两个队伍
            if (!gameStates[hostKey].teamAOperators) {
                gameStates[hostKey].teamAOperators = [];
            }
            if (!gameStates[hostKey].teamBOperators) {
                gameStates[hostKey].teamBOperators = [];
            }
            
            // 将开局干员添加到两个队伍的列表中（开局干员是双方共享的）
            openingOperators.forEach(op => {
                const operatorData = {
                    name: op.name,
                    rarity: op.rarity,
                    profession: op.profession,
                    professionCn: op.professionCn,
                    subClass: op.subClass,
                    avatar: op.avatar,
                    cost: 0
                };
                gameStates[hostKey].teamAOperators.push(operatorData);
                gameStates[hostKey].teamBOperators.push(operatorData);
            });
            console.log(`[开始比赛] 已将 ${openingOperators.length} 名开局干员添加到两队列表`);
            
            // 广播开局展示开始消息（包含干员数据）
            const allConnections = getRoomConnections(hostKey);
            
            const gameStartMsg = JSON.stringify({
                type: 'opening_start',
                phase: 'OPENING_SHOW',
                openingOperators: openingOperators,
                round: gameStates[hostKey].currentRound
            });
            
            console.log(`[开始比赛] 准备广播给 ${allConnections.length} 个客户端`);
            allConnections.forEach((client) => {
                try {
                    client.send(gameStartMsg);
                    console.log(`[开始比赛] 已发送 opening_start 消息给客户端`);
                } catch (error) {
                    console.error(`[开始比赛] 广播失败:`, error);
                }
            });
            
            // 5.5秒后开始倒计时（等待动画播放）
            setTimeout(() => {
                startOpeningCountdown(hostKey);
            }, 5500);
            
                return;
            }
            
        // 新系统：开局倒计时结束，进入等待阶段（客户端通知服务器）
        if (parsed.action === 'opening_complete') {
            const userData = findUserInRoom(socketId);
            if (!userData) return;
            
            const hostKey = userData.hostKey;
            if (!gameStates[hostKey] || gameStates[hostKey].gamePhase !== 'OPENING_SHOW') {
                console.log(`[开局完成] 房间 ${hostKey} 状态不正确，当前阶段: ${gameStates[hostKey]?.gamePhase}`);
                return; // 只有开局展示阶段才能完成
            }
            
            // 更新游戏状态：进入等待阶段
            gameStates[hostKey].gamePhase = 'WAITING';
            gameStates[hostKey].isBidding = false; // 等待主持人点击开始博弈
            // 注意：isFirstRound 应该保持为 true，直到第一次点击"开始博弈"按钮时才设置为 false
            
            // 确保初始化博弈阶段所需的状态
            if (!gameStates[hostKey].bannedBranches) {
                gameStates[hostKey].bannedBranches = new Set();
            }
            // 【重要】takenOperators 只在不存在时初始化，如果已存在则保留（全局共享，不会重置）
            if (!gameStates[hostKey].takenOperators) {
                gameStates[hostKey].takenOperators = new Set();
            }
            if (!gameStates[hostKey].teamAAction) {
                gameStates[hostKey].teamAAction = { type: null, bid: 0, usedIntel: false };
            }
            if (!gameStates[hostKey].teamBAction) {
                gameStates[hostKey].teamBAction = { type: null, bid: 0, usedIntel: false };
            }
            
            // 广播开局完成消息给所有客户端
            const allConnections = getRoomConnections(hostKey);
            
            const completeMsg = JSON.stringify({
                type: 'opening_complete',
                phase: 'WAITING',
                round: gameStates[hostKey].currentRound,
                openingOperators: gameStates[hostKey].openingOperators
            });
            
            allConnections.forEach((client) => {
                try {
                    client.send(completeMsg);
                } catch (error) {
                    console.error(`[开局完成] 广播失败:`, error);
                }
            });
            
            console.log(`[开局完成] 房间 ${hostKey} 已进入等待阶段`);
            return;
        }

        // 【已删除】攻略准备阶段相关逻辑已全部移除
        
        // 主持人：开始新一轮比赛
        // 主持人操作：重新开局（从开局阶段重新开始）
        // 【优化】不验证身份，因为按钮只有主持人可见，前端已经做了权限控制
        if (parsed.action === 'restart_game') {
            const userData = findUserInRoom(socketId);
            if (!userData) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: '未找到用户信息'
                }));
                return;
            }
            
            const hostKey = userData.hostKey;
            const state = gameStates[hostKey];
            if (!state) return;
            
            // 【新增】在重置状态之前，将上一轮两队信息栏中的所有干员加入禁用池
            // 确保禁用池状态已初始化
            if (!state.takenOperators) state.takenOperators = new Set();
            if (!state.bannedMap) state.bannedMap = {};
            
            // 确保队伍干员列表已初始化
            if (!state.teamAOperators) state.teamAOperators = [];
            if (!state.teamBOperators) state.teamBOperators = [];
            
            // 收集所有需要加入禁用池的干员（去重）
            const allOpsToBan = new Map(); // 使用 Map 去重，key 为干员名称
            [...state.teamAOperators, ...state.teamBOperators, ...state.openingOperators].forEach(op => {
                if (op.name && !allOpsToBan.has(op.name)) {
                    allOpsToBan.set(op.name, op);
                }
            });
            
            // 将干员加入禁用池
            allOpsToBan.forEach(op => {
                const operatorName = op.name || op.realName;
                // 如果干员对象中没有 subClass，从 operatorsData 中查找
                let subClass = op.subClass;
                let professionCn = op.professionCn;
                
                if (!subClass && operatorName) {
                    const opData = operatorsData.find(o => o.干员 === operatorName);
                    if (opData) {
                        subClass = opData.分支;
                        professionCn = professionCn || opData.职业;
                    }
                }
                
                if (!operatorName || !subClass) {
                    console.log(`[重新开局] 跳过干员 ${operatorName}：缺少必要信息 (subClass: ${subClass})`);
                    return;
                }
                
                // 添加到 takenOperators
                if (!state.takenOperators.has(operatorName)) {
                    state.takenOperators.add(operatorName);
                    console.log(`[重新开局] 干员 ${operatorName} 已加入全局占用列表`);
                }
                
                // 更新 bannedMap
                if (!state.bannedMap[subClass]) {
                    state.bannedMap[subClass] = {
                        professionCn: professionCn || '',
                        operators: []
                    };
                }
                
                // 检查是否已存在
                const existingIndex = state.bannedMap[subClass].operators.findIndex(o => o.name === operatorName);
                if (existingIndex === -1) {
                    state.bannedMap[subClass].operators.push({
                        name: operatorName,
                        avatar: `/icon/头像_${operatorName}.png`
                    });
                    console.log(`[重新开局] 已将干员 ${operatorName} 添加到 bannedMap (分支: ${subClass})`);
                }
            });
            
            console.log(`[重新开局] 已将 ${allOpsToBan.size} 名干员加入禁用池`);
            
            // 清空队伍干员列表（从信息栏移除）
            state.teamAOperators = [];
            state.teamBOperators = [];
            
            // 广播禁用池更新
            const banUpdateMsg = JSON.stringify({
                type: 'ban_pool_update',
                bannedMap: state.bannedMap,
                takenOperators: Array.from(state.takenOperators)
            });
            getRoomConnections(hostKey).forEach((client) => {
                try {
                    client.send(banUpdateMsg);
                } catch (error) {
                    console.error(`[重新开局] 禁用池广播失败:`, error);
                }
            });
            
            // 重置游戏状态（但保留禁用池和已占用干员）
            state.gamePhase = 'OPENING';
            state.currentRound = 1;
            state.isBidding = false;
            state.isFirstRound = true;
            state.openingOperators = [];
            state.currentBiddingOp = null;
            state.teamAAction = { type: null, bid: 0, usedIntel: false };
            state.teamBAction = { type: null, bid: 0, usedIntel: false };
            state.teamAIntel = false;
            state.teamBIntel = false;
            state.teamAPreBid = null;
            state.teamBPreBid = null;
            // 重置终止状态
            state.teamATerminated = false;
            state.teamBTerminated = false;
            state.firstTerminatedTeam = null;
            // 【修复】重置终止回合数
            state.teamATerminatedRound = null;
            state.teamBTerminatedRound = null;
            // 重置攻略准备状态
            state.strategyTurn = null;
            state.tempStrategyOps = [];
            state.teamAStrategyOps = [];
            state.teamBStrategyOps = [];
            state.teamAStrategyConfirmed = false;
            state.teamBStrategyConfirmed = false;
            // 清除已部署的干员列表
            state.teamADeployed = [];
            state.teamBDeployed = [];
            // 重置资源（但保留禁用池和已占用干员）
            state.teamAResources = { cp: 50, ip: 1 };
            state.teamBResources = { cp: 50, ip: 1 };
            
            const msg = JSON.stringify({
                type: 'game_reset',
                mode: 'FULL',
                phase: 'OPENING'
            });
            getRoomConnections(hostKey).forEach((client) => {
                try {
                    client.send(msg);
                } catch (error) {
                    console.error(`[重新开局] 广播失败:`, error);
                }
            });
            return;
        }
        
        // 主持人操作：重新开始博弈（从博弈阶段重新开始）
        // 【优化】不验证身份，因为按钮只有主持人可见，前端已经做了权限控制
        if (parsed.action === 'restart_bidding') {
            const userData = findUserInRoom(socketId);
            if (!userData) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: '未找到用户信息'
                }));
                return;
            }
            
            const hostKey = userData.hostKey;
            const state = gameStates[hostKey];
            if (!state) return;
            
            // 【新增】在重置状态之前，将上一轮两队信息栏中的所有干员加入禁用池
            // 确保禁用池状态已初始化
            if (!state.takenOperators) state.takenOperators = new Set();
            if (!state.bannedMap) state.bannedMap = {};
            
            // 确保队伍干员列表已初始化
            if (!state.teamAOperators) state.teamAOperators = [];
            if (!state.teamBOperators) state.teamBOperators = [];
            
            // 收集所有需要加入禁用池的干员（去重）
            const allOpsToBan = new Map(); // 使用 Map 去重，key 为干员名称
            [...state.teamAOperators, ...state.teamBOperators, ...state.openingOperators].forEach(op => {
                if (op.name && !allOpsToBan.has(op.name)) {
                    allOpsToBan.set(op.name, op);
                }
            });
            
            // 将干员加入禁用池
            allOpsToBan.forEach(op => {
                const operatorName = op.name || op.realName;
                // 如果干员对象中没有 subClass，从 operatorsData 中查找
                let subClass = op.subClass;
                let professionCn = op.professionCn;
                
                if (!subClass && operatorName) {
                    const opData = operatorsData.find(o => o.干员 === operatorName);
                    if (opData) {
                        subClass = opData.分支;
                        professionCn = professionCn || opData.职业;
                    }
                }
                
                if (!operatorName || !subClass) {
                    console.log(`[重新开始博弈] 跳过干员 ${operatorName}：缺少必要信息 (subClass: ${subClass})`);
                    return;
                }
                
                // 添加到 takenOperators
                if (!state.takenOperators.has(operatorName)) {
                    state.takenOperators.add(operatorName);
                    console.log(`[重新开始博弈] 干员 ${operatorName} 已加入全局占用列表`);
                }
                
                // 更新 bannedMap
                if (!state.bannedMap[subClass]) {
                    state.bannedMap[subClass] = {
                        professionCn: professionCn || '',
                        operators: []
                    };
                }
                
                // 检查是否已存在
                const existingIndex = state.bannedMap[subClass].operators.findIndex(o => o.name === operatorName);
                if (existingIndex === -1) {
                    state.bannedMap[subClass].operators.push({
                        name: operatorName,
                        avatar: `/icon/头像_${operatorName}.png`
                    });
                    console.log(`[重新开始博弈] 已将干员 ${operatorName} 添加到 bannedMap (分支: ${subClass})`);
                }
            });
            
            console.log(`[重新开始博弈] 已将 ${allOpsToBan.size} 名干员加入禁用池`);
            
            // 清空队伍干员列表（从信息栏移除）
            state.teamAOperators = [];
            state.teamBOperators = [];
            
            // 广播禁用池更新
            const banUpdateMsg = JSON.stringify({
                type: 'ban_pool_update',
                bannedMap: state.bannedMap,
                takenOperators: Array.from(state.takenOperators)
            });
            getRoomConnections(hostKey).forEach((client) => {
                try {
                    client.send(banUpdateMsg);
                } catch (error) {
                    console.error(`[重新开始博弈] 禁用池广播失败:`, error);
                }
            });
            
            // 重置博弈相关状态（但保留禁用池和已占用干员）
            state.gamePhase = 'WAITING';
            state.isBidding = false;
            state.currentBiddingOp = null;
            state.teamAAction = { type: null, bid: 0, usedIntel: false };
            state.teamBAction = { type: null, bid: 0, usedIntel: false };
            state.teamAIntel = false;
            state.teamBIntel = false;
            state.teamAPreBid = null;
            state.teamBPreBid = null;
            // 重置终止状态
            state.teamATerminated = false;
            state.teamBTerminated = false;
            state.firstTerminatedTeam = null;
            // 【修复】重置终止回合数
            state.teamATerminatedRound = null;
            state.teamBTerminatedRound = null;
            // 重置攻略准备状态
            state.strategyTurn = null;
            state.tempStrategyOps = [];
            state.teamAStrategyOps = [];
            state.teamBStrategyOps = [];
            state.teamAStrategyConfirmed = false;
            state.teamBStrategyConfirmed = false;
            // 清除已部署的干员列表
            state.teamADeployed = [];
            state.teamBDeployed = [];
            // 重置资源（但保留禁用池和已占用干员）
            state.teamAResources = { cp: 50, ip: 1 };
            state.teamBResources = { cp: 50, ip: 1 };
            
            // 【重要】明确保留以下状态（不重置）：
            // - bannedBranches, takenOperators, bannedMap (禁用池)
            // - teamAOperators, teamBOperators (队伍背包)
            // - openingOperators (开局干员)
            // - currentRound, isFirstRound (轮次信息)
            // 这些字段不会被清除，保持原值
            
            const msg = JSON.stringify({
                type: 'game_reset',
                mode: 'BIDDING',
                phase: 'WAITING'
            });
            getRoomConnections(hostKey).forEach((client) => {
                try {
                    client.send(msg);
                } catch (error) {
                    console.error(`[重新开始博弈] 广播失败:`, error);
                }
            });
            return;
        }
        
        // 主持人：进行下一轮攻略
        // 加载比赛种子 (回溯)
        // 检查干员是否可以加入禁用池（由前端在移除干员时触发）
        if (parsed.action === 'check_operator_ban') {
            const userData = findUserInRoom(socketId);
            if (!userData) return;
            
            const hostKey = userData.hostKey;
            const state = gameStates[hostKey];
            if (!state) return;
            
            const { operatorName, subClass, professionCn, isOpeningOperator } = parsed;
            if (!operatorName) return;
            
            // 确保队伍干员列表已初始化
            if (!state.teamAOperators) state.teamAOperators = [];
            if (!state.teamBOperators) state.teamBOperators = [];
            
            // 检查干员是否还在队伍列表中（基于服务器状态，不依赖前端参数）
            const inTeamA = state.teamAOperators.some(op => op.name === operatorName);
            const inTeamB = state.teamBOperators.some(op => op.name === operatorName);
            
            // 如果是开局干员，需要验证双方是否都已移除
            if (isOpeningOperator) {
                if (inTeamA || inTeamB) {
                    console.log(`[禁用池] 开局干员 ${operatorName} 仍有队伍拥有，不能加入禁用池 (A: ${inTeamA}, B: ${inTeamB})`);
                    return;
                }
                console.log(`[禁用池] 开局干员 ${operatorName} 双方都已移除，可以加入禁用池`);
            } else {
                // 非开局干员：只要从任意队伍移除，就可以加入禁用池
                // 但如果还在某个队伍中，不能加入
                if (inTeamA || inTeamB) {
                    console.log(`[禁用池] 干员 ${operatorName} 仍在队伍中，不能加入禁用池 (A: ${inTeamA}, B: ${inTeamB})`);
                    return;
                }
            }
            
            // 确保 takenOperators 和 bannedMap 已初始化
            if (!state.takenOperators) state.takenOperators = new Set();
            if (!state.bannedMap) state.bannedMap = {};
            
            // 检查 bannedMap 中是否已存在该干员（用于前端显示）
            let alreadyInBannedMap = false;
            if (state.bannedMap[subClass]) {
                alreadyInBannedMap = state.bannedMap[subClass].operators.some(op => op.name === operatorName);
            }
            
            // 如果已经在 bannedMap 中，跳过
            if (alreadyInBannedMap) {
                console.log(`[禁用池] 干员 ${operatorName} 已在 bannedMap 中，跳过`);
                return;
            }
            
            // 如果不在 takenOperators 中，添加到 takenOperators（标记为已占用）
            if (!state.takenOperators.has(operatorName)) {
                state.takenOperators.add(operatorName);
                console.log(`[禁用池] 干员 ${operatorName} 已加入全局占用列表`);
            }
            
            // 更新 bannedMap（用于前端显示）
            if (!state.bannedMap[subClass]) {
                state.bannedMap[subClass] = {
                    professionCn: professionCn,
                    operators: []
                };
            }
            // 添加到 bannedMap
            state.bannedMap[subClass].operators.push({
                name: operatorName,
                avatar: `/icon/头像_${operatorName}.png`
            });
            console.log(`[禁用池] 已将干员 ${operatorName} 添加到 bannedMap (分支: ${subClass})`);
            
            // 广播给所有客户端（包含完整的 bannedMap）
            const banUpdateMsg = JSON.stringify({
                type: 'ban_pool_update',
                bannedMap: state.bannedMap,
                takenOperators: Array.from(state.takenOperators)
            });
            
            console.log(`[禁用池] 准备广播 bannedMap，包含 ${Object.keys(state.bannedMap).length} 个分支，总干员数: ${Object.values(state.bannedMap).reduce((sum, group) => sum + (group.operators?.length || 0), 0)}`);
            
            getRoomConnections(hostKey).forEach((client) => {
                try {
                    client.send(banUpdateMsg);
                } catch (error) {
                    console.error(`[禁用池] 广播失败:`, error);
                }
            });
            
            return;
        }
        
        if (parsed.action === 'load_game_seed') {
            const userData = findUserInRoom(socketId);
            if (!userData || userData.role !== 'hosts') {
                console.log(`[种子] 错误：只有主持人可以加载种子`);
                ws.send(JSON.stringify({
                    type: 'error',
                    message: '只有主持人可以加载种子'
                }));
                return;
            }
            
            const hostKey = userData.hostKey;
            const snapshot = parsed.snapshot;
            if (!snapshot) {
                console.log(`[种子] 错误：种子数据为空`);
                ws.send(JSON.stringify({
                    type: 'error',
                    message: '种子数据为空'
                }));
                return;
            }
            
            console.log(`[种子] 主持人请求加载种子，阶段: ${snapshot.gamePhase}`);
            
            // 1. 恢复服务器端的核心状态 (Game Logic State)
            if (!gameStates[hostKey]) gameStates[hostKey] = {};
            const state = gameStates[hostKey];
            
            // 恢复基础状态
            state.gamePhase = snapshot.gamePhase;
            state.currentRound = snapshot.currentRound || 1;
            state.isBidding = snapshot.isBidding || false;
            state.isFirstRound = snapshot.isFirstRound !== undefined ? snapshot.isFirstRound : false;
            
            // 恢复资源
            state.teamAResources = snapshot.teamAResources || { cp: 50, ip: 1 };
            state.teamBResources = snapshot.teamBResources || { cp: 50, ip: 1 };
            
            // 恢复 Set 集合 (Array -> Set)
            state.bannedBranches = new Set(snapshot.bannedBranches || []);
            state.takenOperators = new Set(snapshot.takenOperators || []);
            
            // 恢复开局干员
            if (snapshot.openingOperators) {
                state.openingOperators = [...snapshot.openingOperators];
            } else {
                state.openingOperators = [];
            }
            
            // 恢复终止状态
            if (snapshot.serverStates) {
                state.teamATerminated = snapshot.serverStates.teamATerminated || false;
                state.teamBTerminated = snapshot.serverStates.teamBTerminated || false;
                state.firstTerminatedTeam = null; // 回溯时重置，由后续操作重新确定
            } else {
                // 兼容旧版本种子
                state.teamATerminated = false;
                state.teamBTerminated = false;
                state.firstTerminatedTeam = null;
            }
            
            // 恢复攻略阶段状态
            if (snapshot.strategyTurn) {
                state.strategyTurn = snapshot.strategyTurn;
            }
            
            // 恢复已部署干员
            if (snapshot.teamADeployed) {
                state.teamADeployed = [...snapshot.teamADeployed];
            }
            if (snapshot.teamBDeployed) {
                state.teamBDeployed = [...snapshot.teamBDeployed];
            }
            
            // 恢复队伍干员列表（如果种子中有，则恢复；否则从其他数据重建）
            if (snapshot.teamAOperators) {
                state.teamAOperators = [...snapshot.teamAOperators];
            } else {
                // 如果没有，初始化为空数组（会在后续操作中重建）
                state.teamAOperators = [];
            }
            if (snapshot.teamBOperators) {
                state.teamBOperators = [...snapshot.teamBOperators];
            } else {
                // 如果没有，初始化为空数组（会在后续操作中重建）
                state.teamBOperators = [];
            }
            
            // 恢复 bannedMap（如果种子中有）
            if (snapshot.bannedMap) {
                state.bannedMap = { ...snapshot.bannedMap };
            } else {
                state.bannedMap = {};
            }
            
            // 清理定时器（如果存在）
            if (state.biddingTimer) {
                clearInterval(state.biddingTimer);
                state.biddingTimer = null;
            }
            
            // 重置动作状态
            state.teamAAction = { type: null, bid: 0, usedIntel: false };
            state.teamBAction = { type: null, bid: 0, usedIntel: false };
            state.teamAPreBid = null;
            state.teamBPreBid = null;
            
            // 2. 广播回溯指令给所有客户端
            // 将服务器端的终止状态注入到 snapshot 里发回去，确保所有客户端状态一致
            const restoredSnapshot = {
                ...snapshot,
                serverStates: {
                    teamATerminated: state.teamATerminated,
                    teamBTerminated: state.teamBTerminated
                }
            };
            
            const restoreMsg = JSON.stringify({
                type: 'game_restore',
                snapshot: restoredSnapshot
            });
            
            getRoomConnections(hostKey).forEach((client) => {
                try {
                    client.send(restoreMsg);
                } catch (error) {
                    console.error(`[种子] 广播失败:`, error);
                }
            });
            
            console.log(`[种子] 房间 ${hostKey} 已回溯到阶段: ${snapshot.gamePhase}`);
            return;
        }
        
        // 【已删除】next_strategy 相关逻辑已移除（攻略准备阶段已删除）

        // 旧系统：直接广播（兼容原有逻辑）
        broadcast(parsed);
    });

    /* ---------- 4. 断线清理 ---------- */
    ws.on('close', (code, reason) => {
        console.log(`[断开] 用户 ${socketId} 断开连接, code: ${code}, reason: ${reason}`);
        
        // 从房间中移除
        const data = findUserInRoom(socketId);
        if (data) {
            const { hostKey, role, index } = data;
            rooms[hostKey][role].splice(index, 1);
            console.log(`[离开] 用户从房间 ${hostKey} 的 ${role} 中移除`);
            broadcastLobbyUpdate(hostKey);
            
            // 清理游戏状态（如果房间为空）
            // const room = rooms[hostKey];
            // const totalUsers = (room.hosts?.length || 0) + (room.teamA?.length || 0) + 
            //                   (room.teamB?.length || 0) + (room.spectators?.length || 0);
            // if (totalUsers === 0 && gameStates[hostKey]) {
            //     // 清理倒计时定时器
            //     if (gameStates[hostKey].countdownTimer) {
            //         clearInterval(gameStates[hostKey].countdownTimer);
            //     }
            //     delete gameStates[hostKey];
            //     console.log(`[清理] 房间 ${hostKey} 的游戏状态已清理`);
            // }
        }
        
        // 清理userMap
        const userIdToDelete = currentUserId || userId;
        if (userIdToDelete && userMap.has(userIdToDelete)) {
            userMap.delete(userIdToDelete);
            console.log(`[清理] 从userMap中移除用户: ${userIdToDelete}`);
        }
        
        // 清理roomMap（旧系统）
        if (currentUserId) {
            for (const [roomId, userIds] of roomMap.entries()) {
                userIds.delete(currentUserId);
                if (userIds.size === 0) {
                    // roomMap.delete(roomId);
                    console.log(`[-]房间 ${roomId} 关闭`);
                }
            }
        }
    });    
    // 添加错误处理
    ws.on('error', (error) => {
        console.error(`[错误] WebSocket错误 ${socketId}:`, error);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`WS server ready on ws://0.0.0.0:${PORT}`));