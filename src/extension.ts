// extension.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const CONFIG_KEY = 'cachedRepoConfig'; // 用于存储缓存的键名

const filename: string = "custom_var.json";
const relative_path: string = path.join('.vscode', filename);
const workspaceFolders = vscode.workspace.workspaceFolders;
const rootPath = workspaceFolders ? workspaceFolders[0].uri.fsPath : '';
const configPath = path.join(rootPath, relative_path);

function workspaceFolderstoString(): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspacePaths = workspaceFolders ? workspaceFolders.map(folder => folder.uri.fsPath) : [];
  return workspacePaths.map(item => String(item)).join(',');;
}

/**
 * 读取配置文件并缓存到工作区状态
 * @param context 扩展上下文
 * @returns Promise<void>
 */
async function loadAndCacheConfig(context: vscode.ExtensionContext): Promise<void> {

    let configObject: any = {};

    if (fs.existsSync(configPath)) {
        try {
            const configContent = fs.readFileSync(configPath, 'utf-8');
            configObject = JSON.parse(configContent);
            //vscode.window.showInformationMessage('Repository configuration loaded successfully!');
        } catch (e: any) {
            vscode.window.showErrorMessage(`Failed to read ${configPath}: ${e.message}`);
            console.error('Error reading ${configPath}:', e);
        }
    } else {
        vscode.window.showWarningMessage('${configPath} not found. Using empty configuration.');
    }

    // 将解析后的对象存储到工作区状态
    await context.workspaceState.update(CONFIG_KEY, configObject);
}

export function activate(context: vscode.ExtensionContext) {
    console.log("debug_v2");
    const outputChannel = vscode.window.createOutputChannel("My Extension");
    outputChannel.appendLine("Hello, VS Code!");
    outputChannel.show();

    // --- 1. 在扩展激活时（VS Code启动/窗口重载）立即加载配置 ---
    loadAndCacheConfig(context);

    // --- 2. 注册一个命令，允许手动刷新配置（可选） ---
    let disposableRefreshConfig = vscode.commands.registerCommand('task-custom-variable.reloadCustomVariable', async () => {
        await loadAndCacheConfig(context);
        //vscode.window.showInformationMessage('Reload Task Custom Variable!');
    });

    // --- 3. 注册一个命令，用于从缓存中获取特定变量 ---
    // 这是任务将调用的命令
    let disposableGetCachedVar = vscode.commands.registerCommand('task-custom-variable.queryCustomVariable', async (varName: string) => {
        const cachedConfig = context.workspaceState.get<any>(CONFIG_KEY);
        if (cachedConfig && cachedConfig[varName] !== undefined) {
            const value=cachedConfig[varName];

            if (Array.isArray(value)) {
                // 如果是数组，确保数组中的每个元素都是字符串
                //return value.map(item => String(item));
                return value.join(",");
            } else {
                if (varName === "workspaceFolders") {
                  return workspaceFolderstoString();
                }
                // 如果是其他类型，统一返回字符串
                return String(value);
            }
            //return String(cachedConfig[varName]); // 确保返回字符串
        }
        // 如果未找到，可以返回空字符串或抛出错误，取决于你的需求
        vscode.window.showWarningMessage(`Variable "${varName}" not found in cached configuration.`);
        return '';
    });

    context.subscriptions.push(disposableRefreshConfig, disposableGetCachedVar);

    // --- 4. 监听配置文件变化 (可选但推荐) ---
    // 当 configPath 发生变化时，自动重新加载
    const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(rootPath, relative_path)
    );
    watcher.onDidChange(async () => {
        //vscode.window.showInformationMessage('configPath changed, reloading configuration...');
        await loadAndCacheConfig(context);
    });
    watcher.onDidCreate(async () => {
        //vscode.window.showInformationMessage('configPath created, loading configuration...');
        await loadAndCacheConfig(context);
    });
    watcher.onDidDelete(async () => {
        //vscode.window.showInformationMessage('configPath deleted, clearing configuration...');
        await context.workspaceState.update(CONFIG_KEY, {}); // 清空缓存
    });

    context.subscriptions.push(watcher);
}

export function deactivate() {
    // 清理资源，例如停止文件监听器（watcher会自动被disposed，但习惯上可以明确清理）
}