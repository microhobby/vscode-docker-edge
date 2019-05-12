import * as vscode from 'vscode';
import { SSHCommands } from './SSHCommands';
const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const node_ssh = require('node-ssh');
const scpClient = require('scp2');

export class LocalCommands {
	
	private localPath: string = <string> vscode.workspace.rootPath;
	private appName: string = <string> vscode.workspace.name;

	constructor(private ip: string)
	{}

	execDockerFile(cbk: any): void {
		/* TODO PLEASE REFACTOR THIS CALLBACK HELL use promises */
		let out: vscode.OutputChannel = vscode.window.createOutputChannel("Torizon Push");
		let apps: string = this.appName;
		let locals: string = this.localPath;
		let ips: string = this.ip;
		let sum: number = 0.0;

		let child: any = cp.exec(
			`docker build -f ${this.localPath}/Dockerfile ${this.localPath} -t torizon/${apps}`,
				(err: any, stdout: string, stderr: string) => {
					if (err) {
						vscode.window.showErrorMessage(stderr);
					} else {
						vscode.window.showInformationMessage("Packing image ....");
						out.appendLine("******************* Running Saving Image ********************");
						let child2: any = cp.exec(
							`docker save torizon/${apps} > ${locals}/.image.tar`,
							(err: any, stdout: string, stderr: string) => {
								if (err) {
									vscode.window.showErrorMessage(stderr);
								} else {
									vscode.window.showInformationMessage("Sending image ....");
									
									out.clear();
									out.appendLine("******************* Running Pushing Image ********************");
									
									/* here the son cry and mother do not see */
									out.append("Pushing ");
									let intv = setInterval(() => {
										out.append(".");
									}, 500);

									let cli = new scpClient.Client();
									scpClient.scp(`${locals}/.image.tar`, {
										host: ips,
										username: 'torizon',
										password: 'torizon',
										path: '/home/torizon/'
									}, cli, function(err: any) {
										console.error(err);
										clearInterval(intv);

										if (err == null) {
											out.appendLine("]");
											out.appendLine("Success!");

											vscode.window.showInformationMessage("Loading image ....");
											out.appendLine("******************* Running Loading Image ********************");
											out.append("Loading ");

											let ssh = new SSHCommands(ips);
											let interv = setInterval(() => {
												out.append(".");
											}, 500);

											ssh.importImage(".image.tar", out).then((ret: Boolean) => {
												clearInterval(interv);

												if (ret) {
													vscode.window.showInformationMessage("Image loaded 😎");
													if (cbk)
														cbk(ret);
												} else {
													vscode.window.showErrorMessage("Error trying to load image on device 🤔");
												}
											});
										} else {
											out.appendLine(err);
											vscode.window.showErrorMessage("Error trying to pushing image to device 🤔");
										}
									});
								}
							}
						);

						child2.stdout.on('data', function(data: any) {
							out.append(data.toString());
						});
					}
				}
			);

		out.show();
		out.appendLine("******************* Running Torizon Push ********************");
		vscode.window.showInformationMessage("building Dockerfile ...");

		child.stdout.on('data', function(data: any) {
			out.append(data.toString());
		});
	}
}
