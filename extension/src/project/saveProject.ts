import { ProjectNode, ProjectTreeProvider } from './projectTree';
import { ProjectDefinition } from './projectDefinition';
import { OpenProjectFile } from './openProject';
import { LispFormatter } from '../format/formatter';

import * as path from 'path'
import * as vscode from 'vscode';
import * as fs from 'fs-extra';

export async function SaveProject() {
    try {
        if (ProjectTreeProvider.hasProjectOpened() == false) {
            return Promise.reject("No project opened yet"); //TBD: localize
        }

        let root = ProjectTreeProvider.instance().projectNode;

        //work out the correct project file text
        let prjFileText = generateProjectText(root);
        if (!prjFileText)
            return Promise.reject("Failed to compose project text"); //TBD: localize

        //format the text before writing to file
        let doc = await vscode.workspace.openTextDocument({ "content": prjFileText, "language": "autolisp" });
        let formatedText = LispFormatter.format(doc, null);

        //write to file
        let targetPath = root.projectFilePath;
        fs.removeSync(targetPath);
        fs.writeFileSync(targetPath, formatedText);

        //at the end, reopen the given project
        return OpenProjectFile(vscode.Uri.file(targetPath));
    }
    catch (e) {
        return Promise.reject(e);
    }
}

//return the raw text of project file, using the latest source file list to replace the original one;
//return null on error
function generateProjectText(root: ProjectNode): string {
    let fileList = makeSourceFileList(root);

    let prjFileText = makeProjectFileHeader(root);
    prjFileText += makeProjectExpression(fileList, root.projectMetadata);
    prjFileText += ';;; EOF';

    return prjFileText;
}

function makeProjectFileHeader(root: ProjectNode): string {
    let today = new Date();
    let ret = ';;; VLisp project file [V2.0] ' + root.projectName;
    ret += ' saved to:[' + root.projectDirectory + ']';
    ret += ' at:[' + today.toLocaleDateString() + ']';
    ret += '\r\n';

    return ret;
}

function makeProjectExpression(srcFileList: string, prjDef: ProjectDefinition): string {
    let ret = '(' + ProjectDefinition.key_expr_name + '\r\n';

    ret += makeKeyValuePair(prjDef, ProjectDefinition.key_name);

    ret += ProjectDefinition.key_own_list + '\r\n';
    ret += srcFileList + '\r\n';

    ret += makeKeyValuePair(prjDef, ProjectDefinition.key_fas_dir);
    ret += makeKeyValuePair(prjDef, ProjectDefinition.key_tmp_dir);
    ret += makeKeyValuePair(prjDef, ProjectDefinition.key_proj_keys);
    ret += makeKeyValuePair(prjDef, ProjectDefinition.key_cxt_id);

    //in case there're some more properties other than the standard properties
    for (let key in prjDef.metaData) {
        if (ProjectDefinition.isStandardProperty(key))
            continue;

        ret += makeKeyValuePair(prjDef, key);
    }

    ret += ')\r\n';

    return ret;
}

function makeKeyValuePair(metaData: ProjectDefinition, key: string): string {
    return key + '\r\n' + metaData.getProperty(key) + '\r\n';
}

function makeSourceFileList(root: ProjectNode): string {
    let fileList = '';

    if (root.sourceFiles.length == 0) {
        fileList = ' nil ';
    }
    else {
        let prjDir = path.normalize(root.projectDirectory).toUpperCase();

        fileList = ' (';

        for (let file of root.sourceFiles) {
            if (file.rawFilePath) {
                fileList += file.rawFilePath; //use the original text read on opening
                fileList += " ";
                continue;
            }

            let fileDir = path.dirname(file.filePath);
            fileDir = path.normalize(fileDir).toUpperCase();

            if (fileDir != prjDir) {
                //in this case, we use absolute path, and file extension will be ignored
                let str2Add = path.normalize(file.filePath).split('\\').join('/');// "/" is used in file path in .prj file
                str2Add = str2Add.substring(0, str2Add.length - 4);//to remove the extension
                fileList += ('\"' + str2Add + '\" ');
                continue;
            }

            //in this case, the directory and file extension will be ignored
            let str2Add = path.basename(file.filePath);
            str2Add = str2Add.substring(0, str2Add.length - 4);//to remove the extension
            fileList += ('\"' + str2Add + '\" ');
            continue;
        }

        fileList = fileList.trimRight() + ') ';
    }

    return fileList;
}
