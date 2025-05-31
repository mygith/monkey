// ==UserScript==
// @name        知乎智能屏蔽
// @namespace   https://github.com/mygith/monkey
// @match       https://www.zhihu.com/
// @grant       none
// @version     0.2
// @author      mygith
// @license     GPL License
// @description 模拟点击实现内容屏蔽
// ==/UserScript==
(function () {
    'use strict';

    // 配置区====================================================
    const stopWords = ['小说', '小米', '华为', '少儿编程', '男生', '女生', '男人', '女人', '匿名', '男朋友', '女朋友', '神器', '虐文', '脱毛', '爱美', '全女', '舔狗', '彩礼', '副业', '抑郁', '跨境电商'];
    const targetSelector = '.Topstory-content, .QuestionPage-main';
    const cardSelector = '.Card:not([data-zf-processed])';
    const titleSelector = '.ContentItem-title, [data-za-detail-view-element_name="Title"], .QuestionHeader-title';
    const menuSelector = '.Menu-item';
    const menuText = '不感兴趣';
    const menuTimeout = 2000; // 菜单等待超时时间

    // 逻辑区 ====================================================
    let observer;

    // 智能点击操作（带重试机制）
    const performBlock = async (card) => {
        try {
            // 第一阶段：点击更多按钮
            const moreBtn = card.querySelector('.ContentItem-action button[aria-label="更多"]');
            if (!moreBtn) {
                console.warn('⚠️ 未找到更多按钮', card);
                return false;
            }
            moreBtn.click();

            // 等待菜单渲染
            const menuItem = await waitForElement();
            if (!menuItem) {
                console.error('⌛ 菜单项加载超时');
                return false;
            }

            // 第二阶段：点击屏蔽项
            menuItem.click();
            return true;
        } catch (e) {
            console.error('❌ 屏蔽流程异常:', e);
            return false;
        }

        function waitForElement() {
            return new Promise((resolve, reject) => {
                const start = Date.now();
                const check = () => {
                    const nodeList = document.querySelectorAll(menuSelector);
                    const el = Array.from(nodeList).find(el =>
                        el.textContent.trim().includes(menuText)
                    );
                    if (el) return resolve(el);
                    if (Date.now() - start > menuTimeout) return reject('Timeout');
                    requestAnimationFrame(check);
                };
                check();
            });
        }
    };

    // 卡片处理器（带状态追踪）
    const processCard = async (card) => {
        if (card.dataset.zfStatus) return; // 防止重复处理

        const title = card.querySelector(titleSelector)?.textContent.trim();
        if (!title) {
            card.dataset.zfStatus = 'no-title';
            return;
        }

        if (stopWords.some(w => title.includes(w))) {
            card.dataset.zfStatus = 'processing';
            performBlock(card);
        } else {
            card.dataset.zfStatus = 'passed';
        }
    };

    // 批量处理器（带节流控制）
    const processCards = (() => {
        let processing = false;
        return (root) => {
            if (processing) return;
            processing = true;

            const cards = Array.from(root.querySelectorAll(cardSelector));
            cards.forEach(card => processCard(card));

            requestAnimationFrame(() => processing = false);
        };
    })();

    // 观察器管理（动态容器感知）
    const initObserver = () => {
        if (observer) observer.disconnect();

        const target = document.querySelector(targetSelector) || document.documentElement;
        processCards(target);

        observer = new MutationObserver(mutations => {
            const needsCheck = mutations.some(m =>
                m.addedNodes.length > 0 ||
                m.attributeName === 'class'
            );
            if (needsCheck) processCards(target);
        });

        observer.observe(target, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });

        // SPA路由检测
        let lastPath = location.pathname;
        const checkRoute = () => {
            if (location.pathname !== lastPath) {
                lastPath = location.pathname;
                initObserver(); // 重新初始化
            }
            requestAnimationFrame(checkRoute);
        };
        checkRoute();
    };

    // 启动控制器
    const init = () => {
        if (document.readyState === 'complete') initObserver();
        else window.addEventListener('load', initObserver, { once: true });
    };

    // 兼容性启动
    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', init)
        : init();
})();