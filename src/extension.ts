'use strict';

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { TorizonDeviceProvider, Device, ContainerOptions } from './TorizonDevProvider';
import { SSHCommands } from './SSHCommands';
import { LocalCommands } from './LocalCommands';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	/* first time here? */
	let local = new LocalCommands("");
	local.runRegistryContainer();

	/* tree view */
	const nodeDependenciesProvider = 
		new TorizonDeviceProvider(vscode.workspace.rootPath);
	vscode.window
		.registerTreeDataProvider(
			'nodeDependencies', 
			nodeDependenciesProvider
	);
	vscode.commands.registerCommand('nodeDependencies.refreshEntry', () =>
		nodeDependenciesProvider.refresh());
	vscode.commands.registerCommand('nodeDependencies.dockerFile', () => {
		//let localCmd: LocalCommands = new LocalCommands();

		///localCmd.execDockerFile();
	});

	/* containers commands */
	vscode.commands.registerCommand('extension.startContainer', 
		(name: string, ip: string) => {
			let ssh = new SSHCommands(ip);
			ssh.startContainer(name);
		});
	vscode.commands.registerCommand('extension.stopContainer', 
		(name: string, ip: string) => {
			let ssh = new SSHCommands(ip);
			ssh.stopContainer(name);
		});
	vscode.commands.registerCommand('extension.restartContainer', 
		(name: string, ip: string) => {
			let ssh = new SSHCommands(ip);
			ssh.restartContainer(name);
		});
	vscode.commands.registerCommand('extension.deleteContainer', 
		(name: string, ip: string) => {
			let ssh = new SSHCommands(ip);
			ssh.deleteContainer(name).then((refresh) => {
				if (refresh) {
					nodeDependenciesProvider.refresh();
				}
			});
		});
	
	/* image commands */
	vscode.commands.registerCommand('extension.runCommandContainer', 
		(name: string, ip: string) => {
			let ssh = new SSHCommands(ip);
			ssh.runImage(name);
		});
	vscode.commands.registerCommand('nodeDependencies.addImageEntry', (node: Device) => {
		let localCmd: LocalCommands = new LocalCommands(<string> node.ip);
		//localCmd.execDockerFile(
		localCmd.execDockerFileFromRegistry(
		(ret: boolean) => {
			if (ret)
				nodeDependenciesProvider.refresh();
		});
	});
	vscode.commands.registerCommand('extension.runDeleteFileContainer', 
			(name: string, ip: string, node: ContainerOptions) => {
		let ssh = new SSHCommands(node.ip);

		if (node.image)
			ssh.deleteImage(node.image.id);
	});

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "torizon" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = 
		vscode.commands.registerCommand('extension.helloWorld', () => {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World!');
		vscode.window.showInputBox().then(str => {
			console.log(str);
		});
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
